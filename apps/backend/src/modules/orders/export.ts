import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { jakartaDay } from "../../utils/validation.js";
import { buildOrderWhere } from "./filters.js";
import type { OrderFilters } from "./schema.js";

const exportInclude = {
  customer: true,
  creator: { select: { name: true } },
  items: {
    include: { product: { select: { productCode: true, productName: true } } },
    orderBy: { id: "asc" as const },
  },
} satisfies Prisma.OrderInclude;
type ExportOrder = Prisma.OrderGetPayload<{ include: typeof exportInclude }>;
const summaryHeaders = [
  "No. Order",
  "Tanggal Order (WIB)",
  "Pelanggan",
  "Telepon",
  "Alamat",
  "Jumlah Produk",
  "Total Quantity",
  "Total Penjualan",
  "Dibuat Oleh",
];
const detailHeaders = [
  "No. Order",
  "Tanggal Order (WIB)",
  "Pelanggan",
  "Kode Produk",
  "Nama Produk",
  "Jumlah",
  "Harga Satuan",
  "Subtotal",
];

/** Mengubah waktu order menjadi teks tanggal dan jam WIB untuk kolom ekspor. */
function orderDateWib(date: Date): string {
  return new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 19).replace("T", " ");
}

/**
 * Membentuk satu baris ringkasan per order, termasuk jumlah jenis produk, total kuantitas, dan
 * total penjualan.
 */
function summaryRow(order: ExportOrder): (string | number)[] {
  return [
    order.orderNumber,
    orderDateWib(order.orderDate),
    order.customer.customerName,
    order.customer.phone ?? "",
    order.customer.customerAddress,
    order.items.length,
    order.items.reduce(
      /* Menjumlahkan kuantitas seluruh item dalam satu order. */ (sum, item) =>
        sum + item.quantity,
      0,
    ),
    order.totalAmount.toFixed(2),
    order.creator.name,
  ];
}

/**
 * Mengamankan sel CSV dari formula spreadsheet dan menggandakan tanda kutip agar koma, kutip,
 * serta baris baru tetap terbaca sebagai isi sel.
 */
function csvCell(value: string | number): string {
  let text = String(value);
  // Tanda kutip saja tidak menghentikan formula spreadsheet dalam nama atau alamat masukan pengguna.
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

/** Menyiapkan kolom, lebar, filter, baris judul yang dibekukan, dan gaya header worksheet Excel. */
function prepareSheet(sheet: ExcelJS.Worksheet, headers: string[], widths: number[]) {
  sheet.columns = headers.map(
    /*
     * Memasangkan setiap judul kolom dengan lebar yang ditentukan atau nilai bawaan.
     */
    (header, index) => ({ header, width: widths[index] ?? 22 }),
  );
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  sheet.getRow(1).height = 24;
  /** Memberi gaya tebal, warna latar, dan garis bawah pada setiap sel header. */
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FF403A32" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEBE3D5" } };
    cell.border = { bottom: { style: "thin", color: { argb: "FFB0A695" } } };
  });
}

/**
 * Mengekspor semua order yang cocok dengan filter tanpa pagination. Data dibaca melalui
 * RepeatableRead; CSV berisi ringkasan, sedangkan XLSX memuat ringkasan dan detail dengan harga
 * transaksi tersimpan.
 */
export async function exportOrders(filters: OrderFilters, format: "csv" | "xlsx") {
  // Baca data beserta relasinya bersama; buat workbook setelah transaksi pembacaan selesai.
  const orders = await prisma.$transaction(
    /*
     * Membaca order beserta relasinya dalam transaksi dengan snapshot yang konsisten sebelum
     * membuat berkas.
     */
    (tx) =>
      tx.order.findMany({
        where: buildOrderWhere(filters),
        include: exportInclude,
        orderBy: [{ orderDate: "desc" }, { id: "desc" }],
      }),
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
  const filename = `riwayat-order-${jakartaDay(new Date()).replaceAll("-", "")}.${format}`;
  if (format === "csv") {
    // Satu baris per order mencegah total terhitung berulang ketika order memiliki beberapa item.
    const lines = [summaryHeaders, ...orders.map(summaryRow)].map(
      /*
       * Mengamankan seluruh sel lalu menggabungkannya dengan koma menjadi satu baris CSV.
       */
      (row) => row.map(csvCell).join(","),
    );
    return {
      filename,
      contentType: "text/csv; charset=utf-8",
      body: Buffer.from(`\uFEFF${lines.join("\r\n")}\r\n`, "utf8"),
    };
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Aza Commerce";
  workbook.created = new Date();
  const summary = workbook.addWorksheet("Ringkasan Order");
  const details = workbook.addWorksheet("Detail Item");
  prepareSheet(summary, summaryHeaders, [26, 24, 26, 22, 40, 18, 18, 24, 24]);
  prepareSheet(details, detailHeaders, [26, 24, 26, 20, 30, 14, 22, 22]);
  summary.getColumn(4).numFmt = "@";
  summary.getColumn(8).numFmt = '"Rp" #,##0.00';
  details.getColumn(7).numFmt = details.getColumn(8).numFmt = '"Rp" #,##0.00';
  for (const order of orders) {
    const values = summaryRow(order);
    values[7] = Number(order.totalAmount.toFixed(2));
    summary.addRow(values);
    for (const item of order.items) {
      // unitPrice dan subtotal tersimpan tetap menjadi acuan meskipun harga katalog berubah.
      details.addRow([
        order.orderNumber,
        orderDateWib(order.orderDate),
        order.customer.customerName,
        item.product.productCode,
        item.product.productName,
        item.quantity,
        Number(item.unitPrice.toFixed(2)),
        Number(item.subtotal.toFixed(2)),
      ]);
    }
  }
  summary.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: summary.rowCount, column: summaryHeaders.length },
  };
  details.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: details.rowCount, column: detailHeaders.length },
  };
  return {
    filename,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    body: Buffer.from(await workbook.xlsx.writeBuffer()),
  };
}
