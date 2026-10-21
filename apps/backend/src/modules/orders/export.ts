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

function orderDateWib(date: Date): string {
  return new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 19).replace("T", " ");
}

function summaryRow(order: ExportOrder): (string | number)[] {
  return [
    order.orderNumber,
    orderDateWib(order.orderDate),
    order.customer.customerName,
    order.customer.phone ?? "",
    order.customer.customerAddress,
    order.items.length,
    order.items.reduce((sum, item) => sum + item.quantity, 0),
    order.totalAmount.toFixed(2),
    order.creator.name,
  ];
}

function csvCell(value: string | number): string {
  let text = String(value);
  // Quoting alone does not stop spreadsheet formulas in user-controlled names/addresses.
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function prepareSheet(sheet: ExcelJS.Worksheet, headers: string[], widths: number[]) {
  sheet.columns = headers.map((header, index) => ({ header, width: widths[index] ?? 22 }));
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  sheet.getRow(1).height = 24;
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FF403A32" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEBE3D5" } };
    cell.border = { bottom: { style: "thin", color: { argb: "FFB0A695" } } };
  });
}

export async function exportOrders(filters: OrderFilters, format: "csv" | "xlsx") {
  // Capture relation data together; generating the workbook happens after the read transaction.
  const orders = await prisma.$transaction(
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
    // One row per order prevents duplicated totals when an order contains multiple items.
    const lines = [summaryHeaders, ...orders.map(summaryRow)].map((row) =>
      row.map(csvCell).join(","),
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
      // Stored unitPrice/subtotal remain authoritative even after catalog price changes.
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
