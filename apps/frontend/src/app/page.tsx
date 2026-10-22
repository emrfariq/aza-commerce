import { redirect } from "next/navigation";
/** Mengarahkan kunjungan ke alamat utama frontend menuju dashboard. */
export default function Home() {
  redirect("/dashboard");
}
