"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { api, queryString } from "@/lib/api";
import type { Customer, Product } from "@/lib/types";
import { rupiah, tanggal } from "@/lib/format";
import {
  Empty,
  ErrorMessage,
  ErrorState,
  FieldError,
  Loading,
  Modal,
  PageTitle,
  Pagination,
  StockBadge,
} from "./ui";

type Row = Product | Customer;
const isProduct = (row: Row): row is Product => "product_code" in row;
const rowName = (row: Row) => (isProduct(row) ? row.product_name : row.customer_name);

export default function MasterData({ kind }: { kind: "products" | "customers" }) {
  const product = kind === "products";
  const label = product ? "produk" : "pelanggan";
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("product_name");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [feedback, setFeedback] = useState("");
  const client = useQueryClient();
  const list = useQuery({
    queryKey: [kind, { page, search, sort }],
    queryFn: () =>
      api<Row[]>(`/${kind}?${queryString({ page, search, ...(product ? { sort } : {}) })}`),
  });
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api(`/${kind}${editing !== "new" && editing ? `/${editing.id}` : ""}`, {
        method: editing === "new" ? "POST" : "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      setEditing(null);
      setFeedback(`${product ? "Produk" : "Pelanggan"} berhasil disimpan.`);
      await client.invalidateQueries();
    },
  });
  const remove = useMutation({
    mutationFn: () => api(`/${kind}/${deleting!.id}`, { method: "DELETE" }),
    onSuccess: async () => {
      setDeleting(null);
      setFeedback(`${product ? "Produk" : "Pelanggan"} berhasil dihapus.`);
      if (list.data?.data.length === 1 && page > 1) setPage(page - 1);
      await client.invalidateQueries();
    },
  });
  function startEdit(row: Row | "new") {
    save.reset();
    setFeedback("");
    setEditing(row);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const entries = Object.fromEntries(new FormData(event.currentTarget));
    const body: Record<string, unknown> = { ...entries };
    if (product) body.stock = Number(entries.stock);
    else body.phone = entries.phone || null;
    save.mutate(body);
  }
  const currentProduct = editing && editing !== "new" && isProduct(editing) ? editing : undefined;
  const currentCustomer = editing && editing !== "new" && !isProduct(editing) ? editing : undefined;
  return (
    <>
      <PageTitle
        eyebrow={product ? "INVENTORI TOKO" : "RELASI PELANGGAN"}
        title={product ? "Produk" : "Pelanggan"}
        description={
          product
            ? "Kelola katalog, harga, dan ketersediaan produk Anda."
            : "Kenali pelanggan dan kelola informasi mereka dengan mudah."
        }
        action={
          <button className="btn" onClick={() => startEdit("new")}>
            <Plus size={18} />
            Tambah {label}
          </button>
        }
      />
      {feedback && (
        <div className="notice success" role="status">
          <Check size={18} />
          {feedback}
        </div>
      )}
      <section className="panel">
        <div className="toolbar">
          <div className="search-box">
            <Search size={18} />
            <input
              aria-label={`Cari ${label}`}
              placeholder={product ? "Cari nama atau kode produk…" : "Cari nama pelanggan…"}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="toolbar-right">
            {product && (
              <select
                aria-label="Urutkan produk"
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value);
                  setPage(1);
                }}
              >
                <option value="product_name">Nama A–Z</option>
                <option value="-product_name">Nama Z–A</option>
                <option value="price">Harga terendah</option>
                <option value="-price">Harga tertinggi</option>
                <option value="stock">Stok terendah</option>
                <option value="-stock">Stok tertinggi</option>
              </select>
            )}
            <span className="count-label">
              {list.data?.meta?.total ?? "—"} {label}
            </span>
          </div>
        </div>
        {list.isPending ? (
          <Loading />
        ) : list.isError ? (
          <ErrorState error={list.error} retry={() => void list.refetch()} />
        ) : !list.data.data.length ? (
          <Empty
            title={search ? "Tidak ada hasil pencarian" : `Belum ada ${label}`}
            description={
              search
                ? "Coba kata kunci yang berbeda."
                : `Mulai dengan menambahkan ${label} pertama Anda.`
            }
            action={
              !search && (
                <button className="btn secondary" onClick={() => startEdit("new")}>
                  Tambah {label}
                </button>
              )
            }
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {product ? (
                    <>
                      <th>Produk</th>
                      <th>Kode</th>
                      <th>Stok</th>
                      <th className="text-right">Harga satuan</th>
                    </>
                  ) : (
                    <>
                      <th>Nama pelanggan</th>
                      <th>Kontak & alamat</th>
                      <th>Gender</th>
                      <th>Tanggal lahir</th>
                    </>
                  )}
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {list.data.data.map((row) => (
                  <tr key={row.id}>
                    {isProduct(row) ? (
                      <>
                        <td>
                          <strong>{row.product_name}</strong>
                        </td>
                        <td>
                          <span className="code-tag">{row.product_code}</span>
                        </td>
                        <td>
                          <StockBadge stock={row.stock} />
                        </td>
                        <td className="text-right font-semibold">{rupiah(row.price)}</td>
                      </>
                    ) : (
                      <>
                        <td>
                          <div className="name-cell">
                            <span className="customer-avatar">{row.customer_name.charAt(0)}</span>
                            <strong>{row.customer_name}</strong>
                          </div>
                        </td>
                        <td>
                          <div className="cell-stack">
                            <span>{row.phone || "Nomor belum diisi"}</span>
                            <small className="muted address-cell">{row.customer_address}</small>
                          </div>
                        </td>
                        <td>
                          <span className="badge neutral">{row.gender}</span>
                        </td>
                        <td>{tanggal(`${row.birth_date}T00:00:00+07:00`)}</td>
                      </>
                    )}
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-btn"
                          aria-label={`Edit ${rowName(row)}`}
                          title="Edit"
                          onClick={() => startEdit(row)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-btn danger-text"
                          aria-label={`Hapus ${rowName(row)}`}
                          title="Hapus"
                          onClick={() => {
                            remove.reset();
                            setDeleting(row);
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination meta={list.data?.meta} onChange={setPage} />
      </section>
      <p className="page-hint">
        {product
          ? "Produk yang dihapus tetap tersimpan dalam riwayat transaksi."
          : "Informasi pelanggan yang dihapus tetap tersedia pada order sebelumnya."}
      </p>
      {editing && (
        <Modal
          title={`${editing === "new" ? "Tambah" : "Edit"} ${label}`}
          onClose={() => setEditing(null)}
          busy={save.isPending}
        >
          <form onSubmit={submit}>
            <fieldset disabled={save.isPending} className="form-stack">
              <ErrorMessage error={save.error} />
              {product ? (
                <>
                  <label>
                    Kode produk
                    <input
                      name="product_code"
                      required
                      maxLength={20}
                      defaultValue={currentProduct?.product_code}
                      placeholder="P0001"
                      autoFocus
                    />
                    <FieldError name="product_code" error={save.error} />
                  </label>
                  <label>
                    Nama produk
                    <input
                      name="product_name"
                      required
                      maxLength={150}
                      defaultValue={currentProduct?.product_name}
                      placeholder="Nama produk"
                    />
                    <FieldError name="product_name" error={save.error} />
                  </label>
                  <div className="form-grid">
                    <label>
                      Harga satuan (Rp)
                      <input
                        name="price"
                        type="number"
                        required
                        min="0.01"
                        max="9999999999.99"
                        step="0.01"
                        defaultValue={currentProduct?.price}
                        placeholder="12000"
                      />
                      <FieldError name="price" error={save.error} />
                    </label>
                    <label>
                      Stok
                      <input
                        name="stock"
                        type="number"
                        required
                        min="0"
                        max="2147483647"
                        step="1"
                        defaultValue={currentProduct?.stock ?? 0}
                      />
                      <FieldError name="stock" error={save.error} />
                    </label>
                  </div>
                </>
              ) : (
                <>
                  <label>
                    Nama pelanggan
                    <input
                      name="customer_name"
                      required
                      maxLength={150}
                      defaultValue={currentCustomer?.customer_name}
                      placeholder="Nama lengkap"
                      autoFocus
                    />
                    <FieldError name="customer_name" error={save.error} />
                  </label>
                  <label>
                    Alamat
                    <textarea
                      name="customer_address"
                      required
                      maxLength={255}
                      rows={3}
                      defaultValue={currentCustomer?.customer_address}
                      placeholder="Alamat pelanggan"
                    />
                    <FieldError name="customer_address" error={save.error} />
                  </label>
                  <div className="form-grid">
                    <label>
                      Gender
                      <select name="gender" defaultValue={currentCustomer?.gender ?? "Pria"}>
                        <option>Pria</option>
                        <option>Wanita</option>
                      </select>
                      <FieldError name="gender" error={save.error} />
                    </label>
                    <label>
                      Tanggal lahir
                      <input
                        name="birth_date"
                        type="date"
                        required
                        max={new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)}
                        defaultValue={currentCustomer?.birth_date}
                      />
                      <FieldError name="birth_date" error={save.error} />
                    </label>
                  </div>
                  <label>
                    Nomor telepon <span className="optional">(opsional)</span>
                    <input
                      name="phone"
                      type="tel"
                      maxLength={20}
                      defaultValue={currentCustomer?.phone ?? ""}
                      placeholder="081234567890"
                    />
                    <FieldError name="phone" error={save.error} />
                  </label>
                </>
              )}
              <div className="modal-actions">
                <button className="btn secondary" type="button" onClick={() => setEditing(null)}>
                  Batal
                </button>
                <button className="btn" type="submit">
                  {save.isPending ? "Menyimpan…" : "Simpan perubahan"}
                </button>
              </div>
            </fieldset>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal title={`Hapus ${label}?`} onClose={() => setDeleting(null)} busy={remove.isPending}>
          <p className="muted">
            Anda akan menghapus <strong>{rowName(deleting)}</strong> dari daftar aktif. Riwayat
            transaksi tetap tersimpan.
          </p>
          <ErrorMessage error={remove.error} />
          <div className="modal-actions">
            <button
              className="btn secondary"
              disabled={remove.isPending}
              onClick={() => setDeleting(null)}
            >
              Batal
            </button>
            <button
              className="btn destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              {remove.isPending ? "Menghapus…" : `Ya, hapus ${label}`}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
