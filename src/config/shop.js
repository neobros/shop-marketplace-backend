// Marketplace-wide settings (amounts in LKR). Keep in sync with shop-marketplace/src/lib/brand.js
export const SHIPPING_FLAT = Number(process.env.SHIPPING_FLAT || 450);
export const FREE_SHIPPING_OVER = Number(process.env.FREE_SHIPPING_OVER || 15000);
export const COMMISSION_RATE = Number(process.env.COMMISSION_RATE || 0.1); // platform fee taken from each sale

export const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
export const SHOP_STATUSES = ['pending', 'approved', 'rejected', 'suspended'];
export const PAYMENT_METHODS = ['cod', 'bank'];

export const DISTRICTS = [
  'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo', 'Galle', 'Gampaha', 'Hambantota',
  'Jaffna', 'Kalutara', 'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala', 'Mannar', 'Matale', 'Matara',
  'Monaragala', 'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa', 'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya',
];
