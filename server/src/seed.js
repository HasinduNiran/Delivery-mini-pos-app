// One-off seeding of the product catalog. Run: npm run seed
const { connectDB, mongoose } = require('./db');
const Product = require('./models/product');

const PRODUCTS = [
  { name: 'Plain Tea', price: 50, costPrice: 30, stock: 100, emoji: '🍵' },
  { name: 'Milk Tea', price: 80, costPrice: 50, stock: 100, emoji: '☕' },
  { name: 'Coffee', price: 120, costPrice: 75, stock: 80, emoji: '☕' },
  { name: 'Bottled Water', price: 60, costPrice: 35, stock: 200, emoji: '💧' },
  { name: 'Soft Drink', price: 150, costPrice: 100, stock: 120, emoji: '🥤' },
  { name: 'Fresh Juice', price: 220, costPrice: 150, stock: 40, emoji: '🧃' },
  { name: 'Egg Roti', price: 90, costPrice: 55, stock: 60, emoji: '🫓' },
  { name: 'Fish Bun', price: 100, costPrice: 65, stock: 60, emoji: '🐟' },
  { name: 'Vegetable Roti', price: 70, costPrice: 45, stock: 60, emoji: '🥬' },
  { name: 'Chicken Patty', price: 160, costPrice: 110, stock: 50, emoji: '🍗' },
  { name: 'Samosa', price: 60, costPrice: 35, stock: 80, emoji: '🥟' },
  { name: 'Doughnut', price: 110, costPrice: 70, stock: 40, emoji: '🍩' },
  { name: 'Croissant', price: 180, costPrice: 120, stock: 30, emoji: '🥐' },
  { name: 'Chocolate Bar', price: 250, costPrice: 180, stock: 70, emoji: '🍫' },
  { name: 'Biscuit Pack', price: 130, costPrice: 90, stock: 90, emoji: '🍪' },
  { name: 'Ice Cream', price: 200, costPrice: 140, stock: 50, emoji: '🍦' },
  { name: 'Banana (each)', price: 40, costPrice: 25, stock: 150, emoji: '🍌' },
  { name: 'Apple (each)', price: 90, costPrice: 60, stock: 100, emoji: '🍎' },
  { name: 'Bread Loaf', price: 140, costPrice: 95, stock: 60, emoji: '🍞' },
  { name: 'Eggs (10)', price: 320, costPrice: 240, stock: 40, emoji: '🥚' },
  { name: 'Milk Packet', price: 230, costPrice: 170, stock: 50, emoji: '🥛' },
  { name: 'Instant Noodles', price: 120, costPrice: 80, stock: 100, emoji: '🍜' },
  { name: 'Chips', price: 150, costPrice: 100, stock: 80, emoji: '🥔' },
  { name: 'Chewing Gum', price: 30, costPrice: 18, stock: 200, emoji: '🫧' },
];

async function seed() {
  await connectDB();
  const count = await Product.countDocuments();
  if (count > 0) {
    console.log(`[seed] ${count} products already exist — skipping.`);
  } else {
    await Product.insertMany(PRODUCTS);
    console.log(`[seed] inserted ${PRODUCTS.length} products.`);
  }
  await mongoose.connection.close();
  process.exit(0);
}

seed().catch((err) => {
  console.error('[seed] failed', err);
  process.exit(1);
});
