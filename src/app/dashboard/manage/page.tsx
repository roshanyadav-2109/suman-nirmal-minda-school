import { redirect } from "next/navigation";

export default function ManageIndex() {
  redirect("/dashboard/manage/students");
}
