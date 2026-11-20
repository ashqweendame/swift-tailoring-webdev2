export const STATUSES = ['Pending', 'Assigned', 'Ready', 'Collected', 'Cancelled'];

// Tailors stop at Ready; the service desk hands the garment over and closes the order.
// Admins can set any status.
export const TAILOR_TRANSITIONS = {
  Pending: ['Assigned'],
  Assigned: ['Ready', 'Pending'],
  Ready: ['Assigned'],
  Collected: [],
  Cancelled: [],
};
export const SERVICE_TRANSITIONS = { Ready: ['Collected'] };

export const JACKET_COMPONENTS = ['Collar', 'Lapel', 'Shoulder', 'Chest', 'Button', 'Button_Stance', 'Pocket', 'Breast_Pocket', 'Sleeve', 'Vents', 'Lining', 'Canvassing'];
export const TROUSER_COMPONENTS = ['Waistband', 'Pleats', 'Break', 'Cuff'];
export const GARMENT_COMPONENTS = { Jacket: JACKET_COMPONENTS, Trouser: TROUSER_COMPONENTS };

export const SUIT_GARMENTS = {
  Two_Piece: ['Jacket', 'Trouser'],
  Tuxedo: ['Jacket', 'Trouser'],
  Single_Jacket: ['Jacket'],
  Single_Trouser: ['Trouser'],
};

export const COLORS = ['Navy', 'Black', 'Gray', 'Brown', 'Tan'];
export const PATTERNS = ['Plain', 'Pinstripe', 'Windowpane', 'Herringbone', 'Glen_Plaid'];
export const MATERIALS = ['Wool', 'Standard', 'Cotton_Linen', 'Velvet', 'Satin'];
export const ROLES = ['Admin', 'Tailor', 'Service'];
