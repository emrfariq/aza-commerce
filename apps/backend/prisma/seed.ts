import { prisma } from "../src/lib/prisma.js";
import { createOrder } from "../src/modules/orders/service.js";
import { seedAdmin } from "./seeds/admin.js";

const names = [
  "Hydrococo 150ml",
  "Kopi Arabika 250g",
  "Teh Melati 50g",
  "Susu Oat 1L",
  "Madu Murni 250ml",
  "Granola Original",
  "Biskuit Gandum",
  "Cokelat Hitam",
  "Minyak Zaitun 250ml",
  "Beras Organik 1kg",
  "Gula Aren 500g",
  "Garam Laut 250g",
  "Pasta Fusilli",
  "Saus Tomat",
  "Selai Stroberi",
  "Air Mineral 600ml",
  "Keripik Pisang",
  "Kacang Almond",
  "Kurma Premium",
  "Matcha Powder",
];
const customerNames = [
  "Budi Santoso",
  "Siti Aminah",
  "Andi Pratama",
  "Dewi Lestari",
  "Rizky Maulana",
  "Putri Maharani",
  "Agus Setiawan",
  "Rina Wulandari",
  "Dimas Saputra",
  "Nadia Permata",
  "Fajar Hidayat",
  "Intan Sari",
  "Rudi Hartono",
  "Maya Anggraini",
  "Bayu Nugroho",
];

async function seed() {
  const user = await seedAdmin();
  const products = [];
  for (const [index, name] of names.entries()) {
    products.push(
      await prisma.product.upsert({
        where: { productCode: `P${String(index + 1).padStart(4, "0")}` },
        update: {},
        create: {
          productCode: `P${String(index + 1).padStart(4, "0")}`,
          productName: name,
          stock: index >= 16 ? index - 16 : 200,
          price: String(12000 + index * 2500),
        },
      }),
    );
  }
  const customers = [];
  for (const [index, name] of customerNames.entries()) {
    const id = `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    customers.push(
      await prisma.customer.upsert({
        where: { id },
        update: {},
        create: {
          id,
          customerName: name,
          customerAddress: `Jl. Merdeka No. ${index + 1}, Jakarta`,
          gender: index % 2 ? "Wanita" : "Pria",
          birthDate: new Date(`${1990 + index}-02-10T00:00:00Z`),
          phone: `08123456${String(index).padStart(4, "0")}`,
        },
      }),
    );
  }
  // Never reset or replenish existing data; subsequent runs only fill the demo order target.
  const count = await prisma.order.count({ where: { createdBy: user.id } });
  for (let index = count; index < 30; index++) {
    const customer = customers[index % customers.length]!;
    const first = products[index % 16]!;
    const second = products[(index + 5) % 16]!;
    const date = new Date(Date.now() - (29 - index) * 86400000);
    await createOrder(
      {
        customer_id: customer.id,
        items: [
          { product_id: Number(first.id), quantity: (index % 3) + 1 },
          { product_id: Number(second.id), quantity: 1 },
        ],
      },
      user.id,
      date,
    );
  }
  console.log(
    "Seed ready: admin from local environment, 20 products, 15 customers, at least 30 orders. Existing records preserved.",
  );
}

seed()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
