export const STAGES = ['Pending', 'Assigned', 'Ready', 'Collected'];
export const STATUSES = [...STAGES, 'Cancelled'];

// Mirrors the server: tailors stop at Ready; the service desk marks orders Collected.
export const TAILOR_TRANSITIONS = {
  Pending: ['Assigned'],
  Assigned: ['Ready', 'Pending'],
  Ready: ['Assigned'],
  Collected: [],
  Cancelled: [],
};

export const SUIT_TYPES = [
  { value: 'Two_Piece', label: '2-piece' },
  { value: 'Single_Jacket', label: 'Single - Jacket' },
  { value: 'Single_Trouser', label: 'Single - Trouser' },
  { value: 'Tuxedo', label: 'Tuxedo' },
];
export const SUIT_GARMENTS = {
  Two_Piece: ['Jacket', 'Trouser'],
  Tuxedo: ['Jacket', 'Trouser'],
  Single_Jacket: ['Jacket'],
  Single_Trouser: ['Trouser'],
};
export const COMPONENTS = {
  Jacket: ['Collar', 'Lapel', 'Shoulder', 'Chest', 'Button', 'Button_Stance', 'Pocket', 'Breast_Pocket', 'Sleeve', 'Vents', 'Lining', 'Canvassing'],
  Trouser: ['Waistband', 'Pleats', 'Break', 'Cuff'],
};
export const COLORS = [
  { value: 'Navy', hex: '#0f172a' },
  { value: 'Black', hex: '#000000' },
  { value: 'Gray', hex: '#808080' },
  { value: 'Brown', hex: '#45260a' },
  { value: 'Tan', hex: '#d69e6b' },
];
export const PATTERNS = ['Plain', 'Pinstripe', 'Windowpane', 'Herringbone', 'Glen_Plaid'];
export const MATERIALS = ['Wool', 'Standard', 'Cotton_Linen', 'Velvet', 'Satin'];
export const ROLES = ['Admin', 'Tailor', 'Service'];
