export interface ElementSpec {
  symbol: string;
  nameVi: string;
  atomicNumber: number;
  color: string;
  radius: number;
  vdwRadius: number;
  metalness: number;
  roughness: number;
}

export const ELEMENT_SPECS: Record<string, ElementSpec> = {
  H: { symbol: 'H', nameVi: 'Hydrogen (Hiđro)', atomicNumber: 1, color: '#F8FAFC', radius: 0.25, vdwRadius: 0.58, metalness: 0.05, roughness: 0.22 },
  C: { symbol: 'C', nameVi: 'Carbon (Cacbon)', atomicNumber: 6, color: '#334155', radius: 0.42, vdwRadius: 0.88, metalness: 0.15, roughness: 0.35 },
  N: { symbol: 'N', nameVi: 'Nitrogen (Nitơ)', atomicNumber: 7, color: '#2563EB', radius: 0.4, vdwRadius: 0.84, metalness: 0.1, roughness: 0.28 },
  O: { symbol: 'O', nameVi: 'Oxygen (Oxi)', atomicNumber: 8, color: '#DC2626', radius: 0.38, vdwRadius: 0.8, metalness: 0.1, roughness: 0.25 },
  Na: { symbol: 'Na', nameVi: 'Sodium (Natri)', atomicNumber: 11, color: '#8B5CF6', radius: 0.54, vdwRadius: 1.05, metalness: 0.72, roughness: 0.2 },
  Mg: { symbol: 'Mg', nameVi: 'Magnesium (Magie)', atomicNumber: 12, color: '#10B981', radius: 0.5, vdwRadius: 0.96, metalness: 0.78, roughness: 0.22 },
  Al: { symbol: 'Al', nameVi: 'Aluminium (Nhôm)', atomicNumber: 13, color: '#94A3B8', radius: 0.52, vdwRadius: 0.98, metalness: 0.85, roughness: 0.18 },
  S: { symbol: 'S', nameVi: 'Sulfur (Lưu huỳnh)', atomicNumber: 16, color: '#EAB308', radius: 0.48, vdwRadius: 0.94, metalness: 0.08, roughness: 0.38 },
  Cl: { symbol: 'Cl', nameVi: 'Chlorine (Clo)', atomicNumber: 17, color: '#16A34A', radius: 0.46, vdwRadius: 0.92, metalness: 0.08, roughness: 0.3 },
  Cu: { symbol: 'Cu', nameVi: 'Copper (Đồng)', atomicNumber: 29, color: '#D97706', radius: 0.54, vdwRadius: 1.02, metalness: 0.88, roughness: 0.16 },
  Zn: { symbol: 'Zn', nameVi: 'Zinc (Kẽm)', atomicNumber: 30, color: '#64748B', radius: 0.54, vdwRadius: 1.02, metalness: 0.82, roughness: 0.2 },
  Br: { symbol: 'Br', nameVi: 'Bromine (Brom)', atomicNumber: 35, color: '#991B1B', radius: 0.5, vdwRadius: 0.98, metalness: 0.12, roughness: 0.28 },
};

export type Vec3Tuple = [number, number, number];

export interface ReactionAtomSpec {
  id: string;
  element: keyof typeof ELEMENT_SPECS;
  startPos: Vec3Tuple;
  tsPos: Vec3Tuple;
  endPos: Vec3Tuple;
  chargeStart?: string;
  chargeEnd?: string;
  roleVi: string;
}

export interface ReactionBondSpec {
  id: string;
  a: number; // index into atoms[]
  b: number; // index into atoms[]
  orderStart: 0 | 1 | 2 | 3;
  orderEnd: 0 | 1 | 2 | 3;
  isIonic?: boolean;
}

export interface ElectronTransferSpec {
  fromAtomIndex: number;
  toAtomIndex: number;
  count: number;
  window: [number, number];
}

export interface Reaction3DPreset {
  id: string;
  title: string;
  equation: string;
  condition?: string;
  grade: string;
  categoryLabel: string;
  catalystSurfaceLabel?: string;
  descriptionStart: string;
  descriptionTS: string;
  descriptionEnd: string;
  atoms: ReactionAtomSpec[];
  bonds: ReactionBondSpec[];
  electronTransfers?: ElectronTransferSpec[];
}

export const REACTION_3D_PRESETS: Reaction3DPreset[] = [
  // 1. ESTERIFICATION: CH3COOH + C2H5OH <=> CH3COOC2H5 + H2O
  {
    id: 'esterification',
    title: 'Phản ứng Ester hóa (Điều chế Ethyl Acetate)',
    equation: 'CH₃COOH + C₂H₅OH ⇌ CH₃COOC₂H₅ + H₂O',
    condition: 'H₂SO₄ đặc, t°',
    grade: 'Lớp 12',
    categoryLabel: 'Ester – Lipid',
    descriptionStart:
      'Phân tử Acid Acetic (nhóm –COOH phẳng) và Ethanol (nhóm –OH) tiến lại gần nhau dưới xúc tác H₂SO₄ đặc.',
    descriptionTS:
      'Giai đoạn chuyển tiếp: Nhóm –OH của acid tách ra kết hợp với nguyên tử H trong nhóm –OH của ancol, đồng thời hình thành cầu nối ester C–O.',
    descriptionEnd:
      'Tạo thành phân tử Ethyl Acetate (CH₃COOC₂H₅) có mùi thơm trái cây đặc trưng và tách ra phân tử nước H₂O (góc liên kết 104,5°).',
    atoms: [
      // 0: C(methyl of acid)
      { id: 'c_me1', element: 'C', startPos: [-3.4, 0.2, 0.0], tsPos: [-2.7, 0.2, 0.0], endPos: [-3.1, 0.2, 0.0], roleVi: 'Cacbon nhóm –CH₃ gốc acid' },
      // 1..3: H on c_me1
      { id: 'h1', element: 'H', startPos: [-4.0, 0.9, 0.5], tsPos: [-3.3, 0.9, 0.5], endPos: [-3.7, 0.9, 0.5], roleVi: 'Hiđro nhóm metyl' },
      { id: 'h2', element: 'H', startPos: [-4.0, -0.5, 0.4], tsPos: [-3.3, -0.5, 0.4], endPos: [-3.7, -0.5, 0.4], roleVi: 'Hiđro nhóm metyl' },
      { id: 'h3', element: 'H', startPos: [-3.5, 0.2, -0.95], tsPos: [-2.8, 0.2, -0.95], endPos: [-3.2, 0.2, -0.95], roleVi: 'Hiđro nhóm metyl' },
      // 4: C(carbonyl)
      { id: 'c_carb', element: 'C', startPos: [-2.0, 0.2, 0.0], tsPos: [-1.3, 0.2, 0.0], endPos: [-1.7, 0.2, 0.0], roleVi: 'Cacbon nhóm cacbonyl C=O (trung tâm phản ứng)' },
      // 5: O(=O carbonyl)
      { id: 'o_carb', element: 'O', startPos: [-1.6, 1.45, 0.0], tsPos: [-1.0, 1.45, 0.0], endPos: [-1.3, 1.45, 0.0], roleVi: 'Oxi nhóm cacbonyl C=O' },
      // 6: O(from acid -OH, leaves to form H2O)
      { id: 'o_leave', element: 'O', startPos: [-1.2, -0.9, 0.1], tsPos: [-0.4, -1.35, 0.35], endPos: [2.2, -2.1, 0.6], roleVi: 'Oxi nhóm –OH của acid, tách ra cùng H tạo H₂O' },
      // 7: H(from acid -OH)
      { id: 'h_acid_oh', element: 'H', startPos: [-1.6, -1.7, 0.2], tsPos: [-0.8, -2.15, 0.45], endPos: [1.55, -2.55, 0.75], roleVi: 'Hiđro nhóm –OH của acid, đi vào phân tử H₂O' },
      // 8: O(alcohol -O-, attaches to C_carb)
      { id: 'o_alc', element: 'O', startPos: [1.3, 0.0, 0.0], tsPos: [0.25, -0.25, -0.1], endPos: [-0.45, -0.45, 0.0], roleVi: 'Oxi của ancol, tạo liên kết ester C–O mới' },
      // 9: H(alcohol -OH, leaves to join o_leave forming H2O)
      { id: 'h_alc', element: 'H', startPos: [0.65, -0.7, 0.25], tsPos: [0.1, -1.1, 0.35], endPos: [2.85, -2.45, 0.75], roleVi: 'Nguyên tử H của ancol tách ra kết hợp tạo H₂O' },
      // 10: C(CH2 of ethyl)
      { id: 'c_et1', element: 'C', startPos: [2.65, 0.3, 0.0], tsPos: [1.55, 0.2, 0.0], endPos: [0.9, 0.05, 0.0], roleVi: 'Cacbon nhóm –CH₂– của gốc etyl' },
      // 11,12: H on c_et1
      { id: 'h_et1', element: 'H', startPos: [2.75, 0.9, 0.82], tsPos: [1.65, 0.8, 0.82], endPos: [1.0, 0.65, 0.82], roleVi: 'Hiđro nhóm metylen' },
      { id: 'h_et2', element: 'H', startPos: [2.75, 0.9, -0.82], tsPos: [1.65, 0.8, -0.82], endPos: [1.0, 0.65, -0.82], roleVi: 'Hiđro nhóm metylen' },
      // 13: C(CH3 of ethyl)
      { id: 'c_et2', element: 'C', startPos: [3.7, -0.8, 0.0], tsPos: [2.65, -0.8, 0.0], endPos: [2.05, -0.85, -0.15], roleVi: 'Cacbon cuối mạch gốc etyl (–CH₃)' },
      // 14..16: H on c_et2
      { id: 'h_et3', element: 'H', startPos: [4.65, -0.45, 0.0], tsPos: [3.6, -0.45, 0.0], endPos: [2.98, -0.48, -0.15], roleVi: 'Hiđro gốc etyl' },
      { id: 'h_et4', element: 'H', startPos: [3.6, -1.4, 0.8], tsPos: [2.55, -1.4, 0.8], endPos: [1.95, -1.4, 0.68], roleVi: 'Hiđro gốc etyl' },
      { id: 'h_et5', element: 'H', startPos: [3.6, -1.4, -0.8], tsPos: [2.55, -1.4, -0.8], endPos: [1.95, -1.4, -0.95], roleVi: 'Hiđro gốc etyl' },
    ],
    bonds: [
      { id: 'b_me_c', a: 0, b: 4, orderStart: 1, orderEnd: 1 },
      { id: 'b_h1', a: 0, b: 1, orderStart: 1, orderEnd: 1 },
      { id: 'b_h2', a: 0, b: 2, orderStart: 1, orderEnd: 1 },
      { id: 'b_h3', a: 0, b: 3, orderStart: 1, orderEnd: 1 },
      { id: 'b_co_dbl', a: 4, b: 5, orderStart: 2, orderEnd: 2 },
      { id: 'b_c_oleave', a: 4, b: 6, orderStart: 1, orderEnd: 0 }, // Breaks!
      { id: 'b_oh_acid', a: 6, b: 7, orderStart: 1, orderEnd: 1 }, // Stays together in H2O
      { id: 'b_o_halc', a: 8, b: 9, orderStart: 1, orderEnd: 0 }, // Breaks!
      { id: 'b_c_oalc', a: 4, b: 8, orderStart: 0, orderEnd: 1 }, // Forms ester C-O!
      { id: 'b_h2o_new', a: 6, b: 9, orderStart: 0, orderEnd: 1 }, // Forms H2O!
      { id: 'b_o_cet1', a: 8, b: 10, orderStart: 1, orderEnd: 1 },
      { id: 'b_het1', a: 10, b: 11, orderStart: 1, orderEnd: 1 },
      { id: 'b_het2', a: 10, b: 12, orderStart: 1, orderEnd: 1 },
      { id: 'b_cet1_2', a: 10, b: 13, orderStart: 1, orderEnd: 1 },
      { id: 'b_het3', a: 13, b: 14, orderStart: 1, orderEnd: 1 },
      { id: 'b_het4', a: 13, b: 15, orderStart: 1, orderEnd: 1 },
      { id: 'b_het5', a: 13, b: 16, orderStart: 1, orderEnd: 1 },
    ],
  },

  // 2. TITRATION NEUTRALIZATION: HCl + NaOH -> NaCl + H2O
  {
    id: 'titration_neutralization',
    title: 'Phản ứng Trung hòa Acid – Base (Chuẩn độ)',
    equation: 'HCl + NaOH → NaCl + H₂O   (H⁺ + OH⁻ → H₂O)',
    grade: 'Lớp 11',
    categoryLabel: 'Chuẩn độ & pH',
    descriptionStart:
      'Phân tử acid HCl (cho proton H⁺) và base NaOH (chứa nhóm OH⁻ và ion Na⁺) tiến lại gần nhau trong dung dịch nước.',
    descriptionTS:
      'Chuyển giao proton: Liên kết H–Cl phân cực đứt ra, ion H⁺ di chuyển sang cặp electron tự do trên nguyên tử O của nhóm OH⁻.',
    descriptionEnd:
      'Hình thành phân tử nước H₂O bền vững (góc liên kết 104,5°) và cặp ion Na⁺–Cl⁻ trung hòa, làm pH tăng vọt tại điểm tương đương.',
    atoms: [
      { id: 'cl', element: 'Cl', startPos: [-2.8, 0.2, 0.0], tsPos: [-2.2, 0.0, 0.2], endPos: [-1.9, -0.35, 0.0], chargeStart: 'δ−', chargeEnd: '⁻', roleVi: 'Nguyên tử Clo nhận electron thành ion Cl⁻' },
      { id: 'h_acid', element: 'H', startPos: [-1.5, 0.2, 0.0], tsPos: [-0.25, 0.2, 0.0], endPos: [1.15, 0.95, 0.2], chargeStart: 'δ+', chargeEnd: '', roleVi: 'Proton H⁺ chuyển từ acid sang nhóm OH⁻ tạo H₂O' },
      { id: 'o_base', element: 'O', startPos: [1.4, 0.1, 0.0], tsPos: [0.95, 0.1, 0.0], endPos: [1.9, 0.3, 0.0], chargeStart: '⁻', chargeEnd: '', roleVi: 'Oxi trong nhóm hiđroxit OH⁻ nhận proton H⁺' },
      { id: 'h_base', element: 'H', startPos: [2.2, 0.65, 0.1], tsPos: [1.75, 0.65, 0.1], endPos: [2.65, 0.95, -0.2], roleVi: 'Nguyên tử H có sẵn trong nhóm OH⁻' },
      { id: 'na', element: 'Na', startPos: [2.8, -0.8, 0.0], tsPos: [0.5, -1.1, 0.3], endPos: [-0.35, -0.35, 0.0], chargeStart: '⁺', chargeEnd: '⁺', roleVi: 'Cation Natri (Na⁺) liên kết ion với Cl⁻' },
    ],
    bonds: [
      { id: 'b_hcl', a: 0, b: 1, orderStart: 1, orderEnd: 0 }, // H-Cl breaks
      { id: 'b_na_oh', a: 2, b: 4, orderStart: 1, orderEnd: 0, isIonic: true }, // Na-OH separates
      { id: 'b_o_h_old', a: 2, b: 3, orderStart: 1, orderEnd: 1 },
      { id: 'b_o_h_new', a: 2, b: 1, orderStart: 0, orderEnd: 1 }, // H2O forms
      { id: 'b_nacl', a: 0, b: 4, orderStart: 0, orderEnd: 1, isIonic: true }, // NaCl ionic pair
    ],
  },

  // 3. GALVANIC CELL Zn-Cu: Zn + Cu2+ -> Zn2+ + Cu
  {
    id: 'galvanic_zn_cu',
    title: 'Pin Galvani Zn–Cu (Trao đổi Electron trên Điện cực)',
    equation: 'Zn + Cu²⁺ → Zn²⁺ + Cu↓',
    grade: 'Lớp 12',
    categoryLabel: 'Pin điện hóa',
    catalystSurfaceLabel: 'Cầu muối KNO₃ & Dung dịch điện li',
    descriptionStart:
      'Thanh Kẽm (Anot −) có thế điện cực chuẩn E° = −0,76V đứng trước Đồng (Catot +, E° = +0,34V) đang tiếp xúc ion Cu²⁺ trong dung dịch.',
    descriptionTS:
      'Oxi hóa – Khử: Nguyên tử Zn nhường 2 electron (2e⁻) truyền qua dây dẫn sang ion Cu²⁺, đồng thời Zn²⁺ tách khỏi mạng tinh thể tan vào dung dịch.',
    descriptionEnd:
      'Zn bị hòa tan thành ion Zn²⁺ (aq), còn ion Cu²⁺ nhận đủ 2e⁻ khử thành nguyên tử Cu kim loại đỏ bám chặt lên thanh Catot.',
    atoms: [
      // Zn lattice anchor & active atom
      { id: 'zn_base1', element: 'Zn', startPos: [-2.8, -0.7, -0.6], tsPos: [-2.8, -0.7, -0.6], endPos: [-2.8, -0.7, -0.6], roleVi: 'Mạng tinh thể Kẽm (Anot)' },
      { id: 'zn_base2', element: 'Zn', startPos: [-2.8, -0.7, 0.6], tsPos: [-2.8, -0.7, 0.6], endPos: [-2.8, -0.7, 0.6], roleVi: 'Mạng tinh thể Kẽm (Anot)' },
      { id: 'zn_active', element: 'Zn', startPos: [-2.3, 0.2, 0.0], tsPos: [-1.1, 0.55, 0.0], endPos: [-0.2, 1.05, 0.25], chargeStart: '⁰', chargeEnd: '²⁺', roleVi: 'Nguyên tử Zn bị oxi hóa nhường 2e⁻ và tan thành Zn²⁺' },
      // Cu active ion -> deposits onto Cu lattice
      { id: 'cu_active', element: 'Cu', startPos: [0.3, 1.05, -0.25], tsPos: [1.3, 0.55, 0.0], endPos: [2.3, 0.2, 0.0], chargeStart: '²⁺', chargeEnd: '⁰', roleVi: 'Ion Cu²⁺ nhận 2e⁻ bị khử thành Cu kim loại bám Catot' },
      { id: 'cu_base1', element: 'Cu', startPos: [2.8, -0.7, -0.6], tsPos: [2.8, -0.7, -0.6], endPos: [2.8, -0.7, -0.6], roleVi: 'Mạng tinh thể Đồng (Catot)' },
      { id: 'cu_base2', element: 'Cu', startPos: [2.8, -0.7, 0.6], tsPos: [2.8, -0.7, 0.6], endPos: [2.8, -0.7, 0.6], roleVi: 'Mạng tinh thể Đồng (Catot)' },
    ],
    bonds: [
      { id: 'b_zn1', a: 0, b: 1, orderStart: 1, orderEnd: 1 },
      { id: 'b_zn_act1', a: 0, b: 2, orderStart: 1, orderEnd: 0 }, // Zn detaches
      { id: 'b_zn_act2', a: 1, b: 2, orderStart: 1, orderEnd: 0 },
      { id: 'b_cu1', a: 4, b: 5, orderStart: 1, orderEnd: 1 },
      { id: 'b_cu_act1', a: 4, b: 3, orderStart: 0, orderEnd: 1 }, // Cu deposits
      { id: 'b_cu_act2', a: 5, b: 3, orderStart: 0, orderEnd: 1 },
    ],
    electronTransfers: [
      { fromAtomIndex: 2, toAtomIndex: 3, count: 2, window: [0.22, 0.78] },
    ],
  },

  // 4. ALUMINUM PRODUCTION: 2Al2O3 -> 4Al + 3O2
  {
    id: 'electrolysis_al2o3',
    title: 'Điện phân nóng chảy Al₂O₃ (Sản xuất Nhôm)',
    equation: '2Al₂O₃ → 4Al + 3O₂↑',
    condition: 'đpnc, Criolit (Na₃AlF₆)',
    grade: 'Lớp 12',
    categoryLabel: 'Luyện kim Nhôm',
    catalystSurfaceLabel: 'Hỗn hợp nóng chảy Al₂O₃ + Criolit (950°C)',
    descriptionStart:
      'Trong hỗn hợp nóng chảy Al₂O₃ + Criolit, liên kết ion Al³⁺–O²⁻ trở nên linh động, sẵn sàng tách dưới tác dụng dòng điện một chiều.',
    descriptionTS:
      'Tại Catot (−): Ion Al³⁺ nhận 3e⁻; tại Anot (+): Ion O²⁻ nhường electron di chuyển về phía nhau tạo thành phân tử O₂.',
    descriptionEnd:
      'Nhôm kim loại nóng chảy lắng xuống đáy catot, còn khí Oxygen (liên kết đôi O=O) thoát lên ở các cực dương than chì.',
    atoms: [
      { id: 'al1', element: 'Al', startPos: [-2.1, -0.1, 0.0], tsPos: [-2.3, -0.5, -0.3], endPos: [-2.5, -0.85, -0.45], chargeStart: '³⁺', chargeEnd: '⁰', roleVi: 'Ion Al³⁺ nhận 3e⁻ tại Catot tạo Al lỏng' },
      { id: 'al2', element: 'Al', startPos: [-0.4, 0.3, 0.0], tsPos: [-1.1, -0.5, 0.3], endPos: [-1.45, -0.85, 0.45], chargeStart: '³⁺', chargeEnd: '⁰', roleVi: 'Ion Al³⁺ nhận 3e⁻ tại Catot tạo Al lỏng' },
      { id: 'al3', element: 'Al', startPos: [0.6, -0.3, 0.2], tsPos: [-1.6, -0.65, 0.7], endPos: [-1.95, -0.1, 0.0], chargeStart: '³⁺', chargeEnd: '⁰', roleVi: 'Ion Al³⁺ di chuyển về cực âm Catot' },
      { id: 'al4', element: 'Al', startPos: [2.2, 0.1, -0.2], tsPos: [-2.2, -0.1, 0.45], endPos: [-2.9, -0.1, 0.3], chargeStart: '³⁺', chargeEnd: '⁰', roleVi: 'Ion Al³⁺ tập trung tạo khối Nhôm nguyên chất' },
      // 6 Oxygen atoms -> 3 O2 molecules on the right
      { id: 'o1', element: 'O', startPos: [-1.3, 0.8, 0.3], tsPos: [0.8, 0.85, 0.2], endPos: [1.3, 1.05, 0.0], chargeStart: '²⁻', chargeEnd: '⁰', roleVi: 'Ion O²⁻ nhường electron tạo khí O₂' },
      { id: 'o2', element: 'O', startPos: [-1.1, -0.7, -0.3], tsPos: [1.5, 0.75, -0.1], endPos: [2.35, 1.05, 0.0], chargeStart: '²⁻', chargeEnd: '⁰', roleVi: 'Nguyên tử O ghép đôi liên kết O=O' },
      { id: 'o3', element: 'O', startPos: [0.1, 1.0, -0.2], tsPos: [1.2, 0.0, 0.8], endPos: [1.7, 0.0, 0.85], chargeStart: '²⁻', chargeEnd: '⁰', roleVi: 'Ion O²⁻ nhường electron tại Anot' },
      { id: 'o4', element: 'O', startPos: [1.3, -0.8, 0.3], tsPos: [2.1, -0.1, 0.7], endPos: [2.75, 0.0, 0.85], chargeStart: '²⁻', chargeEnd: '⁰', roleVi: 'Nguyên tử O ghép đôi tạo khí O₂' },
      { id: 'o5', element: 'O', startPos: [1.6, 0.9, 0.4], tsPos: [1.5, -0.6, -0.8], endPos: [1.7, -0.8, -0.75], chargeStart: '²⁻', chargeEnd: '⁰', roleVi: 'Ion O²⁻ giải phóng khí O₂' },
      { id: 'o6', element: 'O', startPos: [2.8, -0.5, -0.4], tsPos: [2.4, -0.65, -0.7], endPos: [2.75, -0.8, -0.75], chargeStart: '²⁻', chargeEnd: '⁰', roleVi: 'Nguyên tử O tạo phân tử O₂' },
    ],
    bonds: [
      { id: 'b_al1_o1', a: 0, b: 4, orderStart: 1, orderEnd: 0, isIonic: true },
      { id: 'b_al1_o2', a: 0, b: 5, orderStart: 1, orderEnd: 0, isIonic: true },
      { id: 'b_al2_o1', a: 1, b: 4, orderStart: 1, orderEnd: 0, isIonic: true },
      { id: 'b_al2_o3', a: 1, b: 6, orderStart: 1, orderEnd: 0, isIonic: true },
      { id: 'b_al3_o4', a: 2, b: 7, orderStart: 1, orderEnd: 0, isIonic: true },
      { id: 'b_al4_o5', a: 3, b: 8, orderStart: 1, orderEnd: 0, isIonic: true },
      { id: 'b_al4_o6', a: 3, b: 9, orderStart: 1, orderEnd: 0, isIonic: true },
      // Forming O=O double bonds
      { id: 'b_o2_1', a: 4, b: 5, orderStart: 0, orderEnd: 2 },
      { id: 'b_o2_2', a: 6, b: 7, orderStart: 0, orderEnd: 2 },
      { id: 'b_o2_3', a: 8, b: 9, orderStart: 0, orderEnd: 2 },
    ],
    electronTransfers: [
      { fromAtomIndex: 4, toAtomIndex: 0, count: 2, window: [0.25, 0.72] },
    ],
  },

  // 5. HABER-BOSCH: N2 + 3H2 <=> 2NH3
  {
    id: 'haber_nh3',
    title: 'Tổng hợp Amoniac (Quy trình Haber–Bosch)',
    equation: 'N₂ + 3H₂ ⇌ 2NH₃',
    condition: 't° = 450°C, p = 200 atm, xt Fe',
    grade: 'Lớp 11',
    categoryLabel: 'Công nghiệp Hóa chất',
    catalystSurfaceLabel: 'Bề mặt xúc tác Sắt (Fe)',
    descriptionStart:
      'Phân tử N₂ có liên kết ba (N≡N) cực bền cùng 3 phân tử H₂ tiến xuống bề mặt xúc tác sắt ở nhiệt độ và áp suất cao.',
    descriptionTS:
      'Hấp phụ & hoạt hóa trên xúc tác Fe: Liên kết ba N≡N và liên kết đơn H–H bị kéo giãn và đứt gãy, giải phóng các nguyên tử N và H hoạt động.',
    descriptionEnd:
      'Tạo thành 2 phân tử Amoniac (NH₃) dạng chóp tam giác (góc liên kết H–N–H ≈ 107°).',
    atoms: [
      { id: 'n1', element: 'N', startPos: [-0.6, 0.65, 0.0], tsPos: [-1.15, 0.1, 0.0], endPos: [-1.65, 0.25, 0.0], roleVi: 'Nguyên tử Nitơ thứ nhất (từ N≡N)' },
      { id: 'n2', element: 'N', startPos: [0.6, 0.65, 0.0], tsPos: [1.15, 0.1, 0.0], endPos: [1.65, 0.25, 0.0], roleVi: 'Nguyên tử Nitơ thứ hai (từ N≡N)' },
      // 3 H2 molecules
      { id: 'h1', element: 'H', startPos: [-2.6, 1.0, 0.5], tsPos: [-2.0, 0.4, 0.65], endPos: [-2.35, -0.35, 0.65], roleVi: 'Hiđro gắn vào N₁ tạo chóp tam giác' },
      { id: 'h2', element: 'H', startPos: [-2.6, 0.1, 0.5], tsPos: [-1.95, -0.4, -0.55], endPos: [-2.25, -0.35, -0.65], roleVi: 'Hiđro gắn vào N₁ tạo chóp tam giác' },
      { id: 'h3', element: 'H', startPos: [-0.45, -1.2, 0.8], tsPos: [-0.65, -0.55, 0.3], endPos: [-0.95, -0.35, 0.0], roleVi: 'Hiđro gắn vào N₁' },
      { id: 'h4', element: 'H', startPos: [0.45, -1.2, 0.8], tsPos: [0.65, -0.55, 0.3], endPos: [0.95, -0.35, 0.0], roleVi: 'Hiđro gắn vào N₂' },
      { id: 'h5', element: 'H', startPos: [2.6, 1.0, -0.5], tsPos: [2.0, 0.4, 0.65], endPos: [2.35, -0.35, 0.65], roleVi: 'Hiđro gắn vào N₂ tạo chóp tam giác' },
      { id: 'h6', element: 'H', startPos: [2.6, 0.1, -0.5], tsPos: [1.95, -0.4, -0.55], endPos: [2.25, -0.35, -0.65], roleVi: 'Hiđro gắn vào N₂ tạo chóp tam giác' },
    ],
    bonds: [
      { id: 'b_n2', a: 0, b: 1, orderStart: 3, orderEnd: 0 }, // Triple bond breaks!
      { id: 'b_h2_1', a: 2, b: 3, orderStart: 1, orderEnd: 0 },
      { id: 'b_h2_2', a: 4, b: 5, orderStart: 1, orderEnd: 0 },
      { id: 'b_h2_3', a: 6, b: 7, orderStart: 1, orderEnd: 0 },
      // NH3 #1
      { id: 'b_nh_1a', a: 0, b: 2, orderStart: 0, orderEnd: 1 },
      { id: 'b_nh_1b', a: 0, b: 3, orderStart: 0, orderEnd: 1 },
      { id: 'b_nh_1c', a: 0, b: 4, orderStart: 0, orderEnd: 1 },
      // NH3 #2
      { id: 'b_nh_2a', a: 1, b: 5, orderStart: 0, orderEnd: 1 },
      { id: 'b_nh_2b', a: 1, b: 6, orderStart: 0, orderEnd: 1 },
      { id: 'b_nh_2c', a: 1, b: 7, orderStart: 0, orderEnd: 1 },
    ],
  },

  // 6. CONTACT PROCESS: 2SO2 + O2 <=> 2SO3
  {
    id: 'contact_so3',
    title: 'Oxi hóa SO₂ thành SO₃ (Sản xuất H₂SO₄)',
    equation: '2SO₂ + O₂ ⇌ 2SO₃',
    condition: '450°C, xúc tác V₂O₅',
    grade: 'Lớp 11',
    categoryLabel: 'Công nghiệp Hóa chất',
    catalystSurfaceLabel: 'Xúc tác V₂O₅ trong tháp tiếp xúc',
    descriptionStart:
      'Hai phân tử SO₂ (dạng chữ V góc ~119°) tiến lại gần phân tử O₂ (liên kết đôi O=O) trên bề mặt xúc tác V₂O₅.',
    descriptionTS:
      'Liên kết đôi O=O phân ly khi nguyên tử S của mỗi phân tử SO₂ sử dụng cặp electron chưa liên kết để gắn thêm một nguyên tử O.',
    descriptionEnd:
      'Tạo thành hai phân tử Sulfur Trioxide (SO₃) có cấu trúc tam giác đều phẳng hoàn hảo (góc liên kết 120°).',
    atoms: [
      { id: 's1', element: 'S', startPos: [-2.1, 0.2, 0.0], tsPos: [-1.6, 0.15, 0.0], endPos: [-1.8, 0.1, 0.0], roleVi: 'Lưu huỳnh trung tâm thứ nhất (từ +4 lên +6)' },
      { id: 'o1a', element: 'O', startPos: [-3.0, 0.8, 0.3], tsPos: [-2.6, 0.85, 0.0], endPos: [-2.85, 0.8, 0.0], roleVi: 'Oxi của SO₂ thứ nhất' },
      { id: 'o1b', element: 'O', startPos: [-3.0, -0.6, -0.3], tsPos: [-2.4, -0.8, 0.0], endPos: [-2.5, -0.95, 0.0], roleVi: 'Oxi của SO₂ thứ nhất' },
      { id: 's2', element: 'S', startPos: [2.1, 0.2, 0.0], tsPos: [1.6, 0.15, 0.0], endPos: [1.8, 0.1, 0.0], roleVi: 'Lưu huỳnh trung tâm thứ hai (từ +4 lên +6)' },
      { id: 'o2a', element: 'O', startPos: [3.0, 0.8, -0.3], tsPos: [2.6, 0.85, 0.0], endPos: [2.85, 0.8, 0.0], roleVi: 'Oxi của SO₂ thứ hai' },
      { id: 'o2b', element: 'O', startPos: [3.0, -0.6, 0.3], tsPos: [2.4, -0.8, 0.0], endPos: [2.5, -0.95, 0.0], roleVi: 'Oxi của SO₂ thứ hai' },
      // O2 molecule in center splitting to the two S atoms
      { id: 'o_add1', element: 'O', startPos: [-0.52, 0.55, 0.85], tsPos: [-0.7, 0.35, 0.35], endPos: [-0.75, 0.55, 0.0], roleVi: 'Oxi từ O₂ gắn vào S₁ tạo SO₃ phẳng' },
      { id: 'o_add2', element: 'O', startPos: [0.52, 0.55, 0.85], tsPos: [0.7, 0.35, 0.35], endPos: [0.75, 0.55, 0.0], roleVi: 'Oxi từ O₂ gắn vào S₂ tạo SO₃ phẳng' },
    ],
    bonds: [
      { id: 'b_s1a', a: 0, b: 1, orderStart: 2, orderEnd: 2 },
      { id: 'b_s1b', a: 0, b: 2, orderStart: 2, orderEnd: 2 },
      { id: 'b_s2a', a: 3, b: 4, orderStart: 2, orderEnd: 2 },
      { id: 'b_s2b', a: 3, b: 5, orderStart: 2, orderEnd: 2 },
      { id: 'b_o2', a: 6, b: 7, orderStart: 2, orderEnd: 0 }, // O=O breaks
      { id: 'b_so3_1', a: 0, b: 6, orderStart: 0, orderEnd: 2 },
      { id: 'b_so3_2', a: 3, b: 7, orderStart: 0, orderEnd: 2 },
    ],
  },

  // 7. WATER / AQUEOUS ELECTROLYSIS: 2H2O -> 2H2 + O2
  {
    id: 'electrolysis_water',
    title: 'Điện phân Nước / Dung dịch (Sinh khí H₂ & O₂)',
    equation: '2H₂O → 2H₂↑ + O₂↑',
    condition: 'Điện phân dòng điện 1 chiều',
    grade: 'Lớp 12',
    categoryLabel: 'Điện phân',
    descriptionStart:
      'Hai phân tử nước H₂O (dạng gấp khúc góc 104,5°) dưới tác dụng của điện trường giữa hai điện cực trơ.',
    descriptionTS:
      'Các liên kết cộng hóa trị phân cực O–H bị kéo đứt; các nguyên tử H di chuyển về Catot tạo cặp H–H, còn hai nguyên tử O ghép cặp về phía Anot.',
    descriptionEnd:
      'Giải phóng 2 phân tử khí Hiđro (H₂) tại Catot và 1 phân tử khí Oxi (O=O) tại Anot theo đúng tỉ lệ thể tích 2 : 1.',
    atoms: [
      { id: 'o1', element: 'O', startPos: [-1.4, 0.1, 0.0], tsPos: [-0.55, 0.3, 0.0], endPos: [-0.55, 0.5, 0.0], roleVi: 'Oxi từ phân tử H₂O thứ nhất' },
      { id: 'h1a', element: 'H', startPos: [-2.15, 0.65, 0.25], tsPos: [-1.9, -0.35, 0.2], endPos: [-2.15, -0.75, 0.0], roleVi: 'Hiđro tách từ H₂O ghép thành H₂' },
      { id: 'h1b', element: 'H', startPos: [-2.15, -0.55, -0.25], tsPos: [-1.9, -0.95, 0.2], endPos: [-1.38, -0.75, 0.0], roleVi: 'Hiđro tách từ H₂O ghép thành H₂' },
      { id: 'o2', element: 'O', startPos: [1.4, 0.1, 0.0], tsPos: [0.55, 0.3, 0.0], endPos: [0.55, 0.5, 0.0], roleVi: 'Oxi từ phân tử H₂O thứ hai' },
      { id: 'h2a', element: 'H', startPos: [2.15, 0.65, -0.25], tsPos: [1.9, -0.35, -0.2], endPos: [1.38, -0.75, 0.0], roleVi: 'Hiđro tách từ H₂O ghép thành H₂' },
      { id: 'h2b', element: 'H', startPos: [2.15, -0.55, 0.25], tsPos: [1.9, -0.95, -0.2], endPos: [2.15, -0.75, 0.0], roleVi: 'Hiđro tách từ H₂O ghép thành H₂' },
    ],
    bonds: [
      { id: 'b_oh1a', a: 0, b: 1, orderStart: 1, orderEnd: 0 },
      { id: 'b_oh1b', a: 0, b: 2, orderStart: 1, orderEnd: 0 },
      { id: 'b_oh2a', a: 3, b: 4, orderStart: 1, orderEnd: 0 },
      { id: 'b_oh2b', a: 3, b: 5, orderStart: 1, orderEnd: 0 },
      { id: 'b_oo', a: 0, b: 3, orderStart: 0, orderEnd: 2 }, // O=O
      { id: 'b_hh1', a: 1, b: 2, orderStart: 0, orderEnd: 1 }, // H-H
      { id: 'b_hh2', a: 4, b: 5, orderStart: 0, orderEnd: 1 }, // H-H
    ],
  },

  // 8. COMBUSTION OF METHANE: CH4 + 2O2 -> CO2 + 2H2O
  {
    id: 'combustion_ch4',
    title: 'Đốt cháy hoàn toàn Methane (Ankan)',
    equation: 'CH₄ + 2O₂ → CO₂↑ + 2H₂O',
    condition: 't° (khơi mào)',
    grade: 'Lớp 11',
    categoryLabel: 'Hiđrocacbon',
    descriptionStart:
      'Phân tử Methane (CH₄) cấu trúc tứ diện đều hoàn hảo (góc 109,5°) tiếp xúc với 2 phân tử Oxi (O=O).',
    descriptionTS:
      'Ở nhiệt độ cao, các liên kết C–H và O=O đứt gãy; nguyên tử C liên kết mạnh với 2 nguyên tử O, còn 4 H bắt cặp với 2 O còn lại.',
    descriptionEnd:
      'Hình thành phân tử CO₂ thẳng hàng (O=C=O, góc 180°) và 2 phân tử nước H₂O dạng gấp khúc.',
    atoms: [
      { id: 'c', element: 'C', startPos: [-1.8, 0.0, 0.0], tsPos: [-0.8, 0.1, 0.0], endPos: [0.0, 0.55, 0.0], roleVi: 'Cacbon trung tâm chuyển từ tứ diện (CH₄) thành thẳng (CO₂)' },
      { id: 'h1', element: 'H', startPos: [-2.6, 0.65, 0.5], tsPos: [-2.1, -0.4, 0.7], endPos: [-2.65, -0.95, 0.4], roleVi: 'Hiđro tạo phân tử H₂O thứ nhất' },
      { id: 'h2', element: 'H', startPos: [-2.6, -0.65, -0.5], tsPos: [-1.6, -0.9, 0.2], endPos: [-1.45, -1.0, 0.3], roleVi: 'Hiđro tạo phân tử H₂O thứ nhất' },
      { id: 'h3', element: 'H', startPos: [-1.0, 0.75, -0.55], tsPos: [1.5, -0.4, -0.6], endPos: [1.45, -1.0, -0.3], roleVi: 'Hiđro tạo phân tử H₂O thứ hai' },
      { id: 'h4', element: 'H', startPos: [-1.0, -0.75, 0.55], tsPos: [2.2, -0.8, -0.2], endPos: [2.65, -0.95, -0.4], roleVi: 'Hiđro tạo phân tử H₂O thứ hai' },
      // O2 #1
      { id: 'o1', element: 'O', startPos: [1.3, 1.0, 0.45], tsPos: [-0.2, 0.9, 0.2], endPos: [-1.15, 0.55, 0.0], roleVi: 'Oxi gắn liên kết đôi vào C tạo CO₂' },
      { id: 'o2', element: 'O', startPos: [2.35, 1.0, 0.45], tsPos: [0.85, 0.9, -0.2], endPos: [1.15, 0.55, 0.0], roleVi: 'Oxi gắn liên kết đôi vào C tạo CO₂' },
      // O2 #2
      { id: 'o3', element: 'O', startPos: [1.3, -0.8, -0.45], tsPos: [-1.65, -0.45, 0.55], endPos: [-2.05, -0.55, 0.35], roleVi: 'Oxi tạo phân tử H₂O thứ nhất' },
      { id: 'o4', element: 'O', startPos: [2.35, -0.8, -0.45], tsPos: [1.85, -0.45, -0.45], endPos: [2.05, -0.55, -0.35], roleVi: 'Oxi tạo phân tử H₂O thứ hai' },
    ],
    bonds: [
      { id: 'b_ch1', a: 0, b: 1, orderStart: 1, orderEnd: 0 },
      { id: 'b_ch2', a: 0, b: 2, orderStart: 1, orderEnd: 0 },
      { id: 'b_ch3', a: 0, b: 3, orderStart: 1, orderEnd: 0 },
      { id: 'b_ch4', a: 0, b: 4, orderStart: 1, orderEnd: 0 },
      { id: 'b_o2_1', a: 5, b: 6, orderStart: 2, orderEnd: 0 },
      { id: 'b_o2_2', a: 7, b: 8, orderStart: 2, orderEnd: 0 },
      // CO2
      { id: 'b_co1', a: 0, b: 5, orderStart: 0, orderEnd: 2 },
      { id: 'b_co2', a: 0, b: 6, orderStart: 0, orderEnd: 2 },
      // 2 H2O
      { id: 'b_oh1a', a: 7, b: 1, orderStart: 0, orderEnd: 1 },
      { id: 'b_oh1b', a: 7, b: 2, orderStart: 0, orderEnd: 1 },
      { id: 'b_oh2a', a: 8, b: 3, orderStart: 0, orderEnd: 1 },
      { id: 'b_oh2b', a: 8, b: 4, orderStart: 0, orderEnd: 1 },
    ],
  },

  // 9. ALKENE ADDITION: CH2=CH2 + Br2 -> CH2Br-CH2Br
  {
    id: 'addition_c2h4_br2',
    title: 'Phản ứng Cộng Brom vào Etilen (Làm mất màu Br₂)',
    equation: 'CH₂=CH₂ + Br₂ → CH₂Br–CH₂Br',
    grade: 'Lớp 11',
    categoryLabel: 'Hiđrocacbon không no',
    descriptionStart:
      'Phân tử Etilen (C₂H₄) có 6 nguyên tử đồng phẳng (lai hóa sp², góc 120°) và liên kết đôi C=C tiếp cận phân tử Br–Br.',
    descriptionTS:
      'Liên kết π kém bền trong nối đôi C=C mở ra, đồng thời liên kết Br–Br bị phân cực và tách thành 2 nguyên tử Brom cộng vào 2 nguyên tử C.',
    descriptionEnd:
      'Chuyển hóa hoàn toàn từ nối đôi C=C phẳng thành 1,2-đibrometan (CH₂Br–CH₂Br) cấu trúc tứ diện sp³.',
    atoms: [
      { id: 'c1', element: 'C', startPos: [-0.65, -0.35, 0.0], tsPos: [-0.68, -0.25, 0.0], endPos: [-0.72, 0.0, 0.0], roleVi: 'Cacbon thứ nhất (từ sp² phẳng chuyển sang sp³ tứ diện)' },
      { id: 'c2', element: 'C', startPos: [0.65, -0.35, 0.0], tsPos: [0.68, -0.25, 0.0], endPos: [0.72, 0.0, 0.0], roleVi: 'Cacbon thứ hai (từ sp² phẳng chuyển sang sp³ tứ diện)' },
      // H on c1
      { id: 'h1', element: 'H', startPos: [-1.25, -0.35, 0.85], tsPos: [-1.2, -0.65, 0.78], endPos: [-1.15, -0.75, 0.75], roleVi: 'Hiđro gắn trên C₁' },
      { id: 'h2', element: 'H', startPos: [-1.25, -0.35, -0.85], tsPos: [-1.2, -0.65, -0.78], endPos: [-1.15, -0.75, -0.75], roleVi: 'Hiđro gắn trên C₁' },
      // H on c2
      { id: 'h3', element: 'H', startPos: [1.25, -0.35, 0.85], tsPos: [1.2, 0.4, 0.78], endPos: [1.15, 0.65, 0.75], roleVi: 'Hiđro gắn trên C₂' },
      { id: 'h4', element: 'H', startPos: [1.25, -0.35, -0.85], tsPos: [1.2, 0.4, -0.78], endPos: [1.15, 0.65, -0.75], roleVi: 'Hiđro gắn trên C₂' },
      // Br2 approaching from top
      { id: 'br1', element: 'Br', startPos: [-0.65, 1.85, 0.0], tsPos: [-0.72, 1.25, 0.0], endPos: [-1.2, 1.2, 0.0], roleVi: 'Nguyên tử Brom cộng vào C₁' },
      { id: 'br2', element: 'Br', startPos: [0.65, 1.85, 0.0], tsPos: [0.72, 1.0, 0.0], endPos: [1.2, -1.2, 0.0], roleVi: 'Nguyên tử Brom cộng vào C₂ (vị trí anti bền)' },
    ],
    bonds: [
      { id: 'b_cc', a: 0, b: 1, orderStart: 2, orderEnd: 1 }, // Double bond opens to single bond!
      { id: 'b_ch1', a: 0, b: 2, orderStart: 1, orderEnd: 1 },
      { id: 'b_ch2', a: 0, b: 3, orderStart: 1, orderEnd: 1 },
      { id: 'b_ch3', a: 1, b: 4, orderStart: 1, orderEnd: 1 },
      { id: 'b_ch4', a: 1, b: 5, orderStart: 1, orderEnd: 1 },
      { id: 'b_br2', a: 6, b: 7, orderStart: 1, orderEnd: 0 }, // Br-Br breaks
      { id: 'b_cbr1', a: 0, b: 6, orderStart: 0, orderEnd: 1 }, // C-Br forms
      { id: 'b_cbr2', a: 1, b: 7, orderStart: 0, orderEnd: 1 }, // C-Br forms
    ],
  },

  // 10. METAL + ACID: Mg + 2HCl -> MgCl2 + H2
  {
    id: 'metal_acid_mg_hcl',
    title: 'Kim loại Mg tác dụng với Acid HCl',
    equation: 'Mg + 2HCl → MgCl₂ + H₂↑',
    grade: 'Lớp 10 · 12',
    categoryLabel: 'Kim loại & Acid',
    descriptionStart:
      'Nguyên tử Magie (Mg) đứng trước Hiđro trong dãy hoạt động hóa học tiếp xúc với 2 phân tử acid HCl.',
    descriptionTS:
      'Mg nhường 2 electron cho 2 ion H⁺ từ hai phân tử HCl, phá vỡ liên kết H–Cl đồng thời hai nguyên tử H kết hợp với nhau.',
    descriptionEnd:
      'Sinh ra phân tử khí Hiđro (H₂) bay lên và muối Magie Clorua (Cl–Mg–Cl).',
    atoms: [
      { id: 'mg', element: 'Mg', startPos: [0.0, -0.5, 0.0], tsPos: [0.0, -0.35, 0.0], endPos: [0.0, -0.35, 0.0], chargeStart: '⁰', chargeEnd: '²⁺', roleVi: 'Nguyên tử Mg bị oxi hóa nhường 2e⁻ tạo Mg²⁺' },
      { id: 'h1', element: 'H', startPos: [-1.4, 0.35, 0.0], tsPos: [-0.6, 0.85, 0.0], endPos: [-0.42, 1.35, 0.0], chargeStart: '⁺', chargeEnd: '⁰', roleVi: 'Ion H⁺ nhận 1e⁻ ghép đôi tạo khí H₂ bay lên' },
      { id: 'cl1', element: 'Cl', startPos: [-2.6, 0.35, 0.0], tsPos: [-1.9, -0.1, 0.0], endPos: [-1.6, -0.35, 0.0], chargeStart: '⁻', chargeEnd: '⁻', roleVi: 'Anion Cl⁻ liên kết với Mg²⁺ tạo muối MgCl₂' },
      { id: 'h2', element: 'H', startPos: [1.4, 0.35, 0.0], tsPos: [0.6, 0.85, 0.0], endPos: [0.42, 1.35, 0.0], chargeStart: '⁺', chargeEnd: '⁰', roleVi: 'Ion H⁺ nhận 1e⁻ ghép đôi tạo khí H₂ bay lên' },
      { id: 'cl2', element: 'Cl', startPos: [2.6, 0.35, 0.0], tsPos: [1.9, -0.1, 0.0], endPos: [1.6, -0.35, 0.0], chargeStart: '⁻', chargeEnd: '⁻', roleVi: 'Anion Cl⁻ liên kết với Mg²⁺ tạo muối MgCl₂' },
    ],
    bonds: [
      { id: 'b_hcl1', a: 1, b: 2, orderStart: 1, orderEnd: 0 },
      { id: 'b_hcl2', a: 3, b: 4, orderStart: 1, orderEnd: 0 },
      { id: 'b_hh', a: 1, b: 3, orderStart: 0, orderEnd: 1 },
      { id: 'b_mgcl1', a: 0, b: 2, orderStart: 0, orderEnd: 1, isIonic: true },
      { id: 'b_mgcl2', a: 0, b: 4, orderStart: 0, orderEnd: 1, isIonic: true },
    ],
    electronTransfers: [
      { fromAtomIndex: 0, toAtomIndex: 1, count: 1, window: [0.22, 0.65] },
      { fromAtomIndex: 0, toAtomIndex: 3, count: 1, window: [0.22, 0.65] },
    ],
  },
];

export function getDefault3DReactionForModule(moduleId?: string | null): string {
  switch (moduleId) {
    case 'ester_lab':
      return 'esterification';
    case 'titration':
      return 'titration_neutralization';
    case 'galvanic_cell':
      return 'galvanic_zn_cu';
    case 'aluminum_prod':
      return 'electrolysis_al2o3';
    case 'electrolysis':
      return 'electrolysis_water';
    case 'industrial_prod':
      return 'haber_nh3';
    default:
      return 'esterification';
  }
}
