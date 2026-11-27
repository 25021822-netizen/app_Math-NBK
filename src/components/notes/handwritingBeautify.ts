import { InkElement, InkStroke, InkTextItem } from './types';
import { Bounds, drawInkStroke, getElementBounds } from './inkRenderer';

export interface StrokeCluster {
  index: number;
  strokes: InkStroke[];
  strokeIds: Set<string>;
  bounds: Bounds;
  dominantColor: string;
  estimatedFontSize: number;
}

export interface BeautifyResult {
  nextElements: InkElement[];
  convertedCount: number;
  skippedDrawingsCount: number;
}

function boxesCloseOrOverlap(a: Bounds, b: Bounds, gapX: number, gapY: number): boolean {
  return (
    a.minX - gapX <= b.maxX &&
    a.maxX + gapX >= b.minX &&
    a.minY - gapY <= b.maxY &&
    a.maxY + gapY >= b.minY
  );
}

/**
 * Nhóm các nét bút mực/bút chì gần nhau (cùng dòng chữ hoặc dấu tiếng Việt phía trên/dưới)
 * thành các cụm chữ viết tay. Tuyệt đối bỏ qua hình vẽ (shape), ảnh, bút dạ quang và chữ gõ sẵn.
 */
export function buildHandwritingClusters(strokes: InkStroke[]): StrokeCluster[] {
  if (strokes.length === 0) return [];

  const boxes = strokes.map((s) => getElementBounds(s));
  const n = strokes.length;
  const parent = Array.from({ length: n }, (_, i) => i);

  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let i = 0; i < n; i++) {
    const bi = boxes[i];
    const wi = Math.max(1, bi.maxX - bi.minX);
    const hi = Math.max(1, bi.maxY - bi.minY);
    const isSmallAccentI = wi < 44 && hi < 44;

    for (let j = i + 1; j < n; j++) {
      const bj = boxes[j];
      const wj = Math.max(1, bj.maxX - bj.minX);
      const hj = Math.max(1, bj.maxY - bj.minY);
      const isSmallAccentJ = wj < 44 && hj < 44;

      // Dấu tiếng Việt / dấu chấm / gạch ngang ngắn dễ dính vào chữ gần nhất
      if (isSmallAccentI || isSmallAccentJ) {
        if (boxesCloseOrOverlap(bi, bj, 46, 44)) {
          union(i, j);
          continue;
        }
      }

      // Cùng một dòng chữ viết tay: chồng lấn chiều dọc hoặc lệch tâm dọc nhỏ, cách ngang vừa phải
      const overlapY = Math.min(bi.maxY, bj.maxY) - Math.max(bi.minY, bj.minY);
      const minH = Math.max(12, Math.min(hi, hj));
      const sameLineVertical = overlapY >= -10 && (overlapY >= minH * 0.22 || Math.abs((bi.minY + bi.maxY) / 2 - (bj.minY + bj.maxY) / 2) <= 24);
      const horizGap = Math.max(0, Math.max(bi.minX, bj.minX) - Math.min(bi.maxX, bj.maxX));

      if (sameLineVertical && horizGap <= Math.max(76, minH * 1.9)) {
        union(i, j);
      }
    }
  }

  const groupMap = new Map<number, InkStroke[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const list = groupMap.get(root);
    if (list) list.push(strokes[i]);
    else groupMap.set(root, [strokes[i]]);
  }

  const rawClusters: Omit<StrokeCluster, 'index'>[] = [];
  for (const groupStrokes of groupMap.values()) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const colorCounts = new Map<string, number>();

    for (const st of groupStrokes) {
      const b = getElementBounds(st);
      minX = Math.min(minX, b.minX);
      minY = Math.min(minY, b.minY);
      maxX = Math.max(maxX, b.maxX);
      maxY = Math.max(maxY, b.maxY);
      const c = st.color || '#0f172a';
      colorCounts.set(c, (colorCounts.get(c) || 0) + st.points.length);
    }

    let dominantColor = '#0f172a';
    let bestWeight = -1;
    for (const [col, weight] of colorCounts.entries()) {
      if (weight > bestWeight) {
        bestWeight = weight;
        dominantColor = col;
      }
    }

    const boxH = Math.max(20, maxY - minY);
    // Ước lượng cỡ chữ gọn đẹp khớp với độ cao dòng chữ viết tay
    const estimatedFontSize = Math.round(Math.max(22, Math.min(44, boxH * 0.58)));

    rawClusters.push({
      strokes: groupStrokes,
      strokeIds: new Set(groupStrokes.map((s) => s.id)),
      bounds: { minX, minY, maxX, maxY },
      dominantColor,
      estimatedFontSize,
    });
  }

  // Sắp xếp từ trên xuống dưới, trái sang phải
  rawClusters.sort((a, b) => {
    const rowDiff = a.bounds.minY - b.bounds.minY;
    if (Math.abs(rowDiff) > 28) return rowDiff;
    return a.bounds.minX - b.bounds.minX;
  });

  return rawClusters.map((c, index) => ({ ...c, index }));
}

function renderClustersToRecognitionImage(clusters: StrokeCluster[]): string {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const c of clusters) {
    minX = Math.min(minX, c.bounds.minX);
    minY = Math.min(minY, c.bounds.minY);
    maxX = Math.max(maxX, c.bounds.maxX);
    maxY = Math.max(maxY, c.bounds.maxY);
  }

  const pad = 44;
  const cropX = Math.max(0, minX - pad);
  const cropY = Math.max(0, minY - pad);
  const cropW = Math.max(200, maxX - minX + pad * 2);
  const cropH = Math.max(120, maxY - minY + pad * 2);

  const scale = Math.min(1.6, Math.max(0.65, 1350 / Math.max(cropW, cropH)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(cropW * scale);
  canvas.height = Math.round(cropH * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-cropX, -cropY);

  // Vẽ nét mực đậm rõ ràng trên nền trắng để AI đọc dấu tiếng Việt chính xác nhất
  for (const cluster of clusters) {
    for (const stroke of cluster.strokes) {
      drawInkStroke(ctx, {
        ...stroke,
        color: '#0f172a',
        opacity: 1,
        width: Math.max(3, stroke.width),
      });
    }
  }

  // Vẽ khung đánh số #0, #1... quanh từng cụm
  for (const cluster of clusters) {
    const b = cluster.bounds;
    const bx = b.minX - 10;
    const by = b.minY - 10;
    const bw = Math.max(24, b.maxX - b.minX + 20);
    const bh = Math.max(24, b.maxY - b.minY + 20);

    ctx.save();
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = Math.max(1.5, 1.8 / scale);
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(bx, by, bw, bh);

    const badgeText = `#${cluster.index}`;
    const fontPx = Math.round(Math.max(15, 16 / scale));
    ctx.font = `700 ${fontPx}px sans-serif`;
    const textW = ctx.measureText(badgeText).width;
    const tagW = textW + 10;
    const tagH = fontPx + 6;
    const tagY = Math.max(cropY + 2, by - tagH + 2);

    ctx.fillStyle = '#2563eb';
    ctx.fillRect(bx, tagY, tagW, tagH);
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, bx + 5, tagY + tagH / 2);
    ctx.restore();
  }

  ctx.restore();
  return canvas.toDataURL('image/png');
}

function createTextId(): string {
  return `txt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Nhận diện và chuyển chữ viết tay (bút mực/bút chì) thành chữ viết thẳng hàng, sạch đẹp.
 * Tuyệt đối không động chạm tới hình vẽ (shape), hình vẽ tay tự do không phải chữ, ảnh hay dạ quang.
 */
export async function beautifyHandwrittenText(
  elements: InkElement[],
  selectedIds: string[]
): Promise<BeautifyResult> {
  const selectedSet = selectedIds.length > 0 ? new Set(selectedIds) : null;

  const candidateStrokes = elements.filter((el): el is InkStroke => {
    if (el.kind !== 'stroke') return false;
    if (el.tool !== 'pen' && el.tool !== 'pencil') return false;
    if (selectedSet && !selectedSet.has(el.id)) return false;
    return el.points.length > 0;
  });

  if (candidateStrokes.length === 0) {
    throw new Error(
      selectedSet
        ? 'Vùng đã chọn không có nét chữ viết tay (hình vẽ và ảnh được giữ nguyên).'
        : 'Trang hiện tại chưa có nét chữ viết tay để chỉnh sửa.'
    );
  }

  const clusters = buildHandwritingClusters(candidateStrokes);
  const imageDataUrl = renderClustersToRecognitionImage(clusters);

  const response = await fetch('/api/notes/beautify-handwriting', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageDataUrl,
      clusterCount: clusters.length,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || 'Không thể nhận diện chữ viết tay lúc này.');
  }

  const items: Array<{ index: number; isText: boolean; recognizedText: string }> =
    Array.isArray(payload.items) ? payload.items : [];

  const strokeIdsToReplace = new Set<string>();
  const newTextItems: InkTextItem[] = [];
  let skippedDrawingsCount = 0;

  for (const cluster of clusters) {
    const match = items.find((it) => it.index === cluster.index);
    if (!match || !match.isText || !match.recognizedText.trim()) {
      skippedDrawingsCount++;
      continue;
    }

    cluster.strokeIds.forEach((id) => strokeIdsToReplace.add(id));
    newTextItems.push({
      id: createTextId(),
      kind: 'text',
      x: Math.round(cluster.bounds.minX),
      y: Math.round(cluster.bounds.minY),
      text: match.recognizedText.trim(),
      color: cluster.dominantColor,
      fontSize: cluster.estimatedFontSize,
    });
  }

  if (newTextItems.length === 0) {
    return {
      nextElements: elements,
      convertedCount: 0,
      skippedDrawingsCount,
    };
  }

  const remaining = elements.filter((el) => !strokeIdsToReplace.has(el.id));
  return {
    nextElements: [...remaining, ...newTextItems],
    convertedCount: newTextItems.length,
    skippedDrawingsCount,
  };
}
