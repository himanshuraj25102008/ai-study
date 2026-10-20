"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, isAdminEmail } from "@/lib/supabase/server";

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

async function requireUser() {
  const supabase = await createClient();
  if (!supabase) throw new Error("Configure Supabase in .env.local before using this feature.");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?error=Please+sign+in+first");
  return { supabase, user };
}

async function requireAdmin() {
  const context = await requireUser();
  if (!context.user.email_confirmed_at || !isAdminEmail(context.user.email)) {
    throw new Error("Only the verified configured administrator can perform this action.");
  }
  return context;
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) redirect("/?error=Supabase+is+not+configured");
  const provider = field(formData, "provider");
  if (provider !== "google" && provider !== "facebook" && provider !== "apple") redirect("/?error=Unsupported+provider");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback` },
  });
  if (error) redirect(`/?error=${encodeURIComponent(error.message)}`);
  if (data.url) redirect(data.url);
  redirect("/?error=Could+not+start+sign-in");
}

export async function signOut() {
  const supabase = await createClient();
  if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) redirect(`/?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/");
}

export async function createQuiz(formData: FormData) {
  const { supabase } = await requireAdmin();
  const title = field(formData, "title");
  if (!title) throw new Error("A quiz title is required.");
  const { error } = await supabase.from("quizzes").insert({
    title, description: field(formData, "description"), is_active: true,
  });
  if (error) throw new Error(`Could not create quiz: ${error.message}`);
  revalidatePath("/");
}

export async function deleteQuiz(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = field(formData, "quiz_id");
  if (!id) throw new Error("A quiz must be selected.");
  const { error } = await supabase.from("quizzes").delete().eq("id", id);
  if (error) throw new Error(`Could not delete quiz: ${error.message}`);
  revalidatePath("/");
}

export async function deleteNote(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = field(formData, "file_id");
  const path = field(formData, "path");
  if (!id || !path) throw new Error("A study resource must be selected.");
  const { error: storageError } = await supabase.storage.from("study-files").remove([path]);
  if (storageError) throw new Error(`Could not remove study file: ${storageError.message}`);
  const { error } = await supabase.from("note_files").delete().eq("id", id);
  if (error) throw new Error(`File removed from storage but its library record could not be removed: ${error.message}`);
  revalidatePath("/");
}

export async function createQuestion(formData: FormData) {
  const { supabase } = await requireAdmin();
  const quizId = field(formData, "quiz_id");
  const prompt = field(formData, "prompt");
  const kind = field(formData, "kind");
  const expected = field(formData, "correct_answer");
  if (!quizId || !prompt || !expected || (kind !== "choice" && kind !== "integer" && kind !== "number")) throw new Error("Complete every required question field.");
  if (expected.length > 128) throw new Error("Answers must be 128 characters or fewer.");
  let options: string[] = [];
  if (kind === "choice") {
    options = [...new Set(field(formData, "options").split("\n").map((value) => value.trim()).filter(Boolean))];
    if (options.length < 2 || !options.includes(expected)) throw new Error("Add at least two choices and match the correct answer exactly.");
  }
  if (kind === "integer" && !/^-?\d+$/.test(expected)) throw new Error("Integer questions need a whole-number answer.");
  if (kind === "number" && (!/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(expected) || expected.length > 128)) {
    throw new Error("Numeric questions need a valid finite number.");
  }
  const { data, error } = await supabase.from("quiz_questions")
    .insert({ quiz_id: quizId, prompt, kind, options }).select("id").single();
  if (error || !data) throw new Error(`Could not create question: ${error?.message || "Missing question record."}`);
  const { error: keyError } = await supabase.from("question_keys").insert({ question_id: data.id, correct_answer: expected });
  if (keyError) throw new Error(`Could not save answer key: ${keyError.message}`);
  revalidatePath("/");
}

export async function deleteQuestion(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = field(formData, "question_id");
  if (!id) throw new Error("A question must be selected.");
  const { error } = await supabase.from("quiz_questions").delete().eq("id", id);
  if (error) throw new Error(`Could not delete question: ${error.message}`);
  revalidatePath("/");
}

export async function submitAnswer(formData: FormData) {
  const { supabase } = await requireUser();
  const questionId = field(formData, "question_id");
  const answer = field(formData, "answer");
  if (!questionId || !answer) throw new Error("Select or enter an answer before submitting.");
  if (answer.length > 128) throw new Error("Answers must be 128 characters or fewer.");
  const { error } = await supabase.rpc("submit_quiz_answer", { p_question_id: questionId, p_answer: answer });
  if (error) throw new Error(`Answer could not be submitted: ${error.message}`);
  revalidatePath("/");
}

export async function createFolder(formData: FormData) {
  const { supabase } = await requireAdmin();
  const name = field(formData, "name");
  if (!name) throw new Error("A folder name is required.");
  const { error } = await supabase.from("note_folders").insert({ name });
  if (error) throw new Error(`Could not create folder: ${error.message}`);
  revalidatePath("/");
}

export async function uploadNote(formData: FormData) {
  const { supabase } = await requireAdmin();
  const folderId = field(formData, "folder_id");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0 || !folderId) throw new Error("Choose a folder and a file.");
  if (file.size > 20 * 1024 * 1024) throw new Error("Files must be 20 MB or smaller.");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  const path = `${folderId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from("study-files").upload(path, file, {
    contentType: file.type || "application/octet-stream", upsert: false,
  });
  if (uploadError) throw new Error(`Could not upload file: ${uploadError.message}`);
  const { error } = await supabase.from("note_files").insert({ folder_id: folderId, name: file.name, storage_path: path });
  if (error) {
    const { error: cleanupError } = await supabase.storage.from("study-files").remove([path]);
    const cleanupMessage = cleanupError ? ` File cleanup also failed: ${cleanupError.message}` : "";
    throw new Error(`Could not save file details: ${error.message}.${cleanupMessage}`);
  }
  revalidatePath("/");
}

export async function openNote(formData: FormData) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.storage.from("study-files").createSignedUrl(field(formData, "path"), 60);
  if (error || !data) throw new Error(`Could not open file: ${error?.message || "No download link returned."}`);
  redirect(data.signedUrl);
}

export async function submitHelpdesk(formData: FormData) {
  const { supabase, user } = await requireUser();
  const subject = field(formData, "subject");
  const message = field(formData, "message");
  if (!subject || !message) throw new Error("Add a subject and a message.");
  const { error } = await supabase.from("helpdesk_queries").insert({ user_id: user.id, subject, message });
  if (error) throw new Error(`Could not send query: ${error.message}`);
  revalidatePath("/");
}

export async function updateQueryStatus(formData: FormData) {
  const { supabase } = await requireAdmin();
  const status = field(formData, "status");
  if (!field(formData, "query_id") || (status !== "open" && status !== "resolved")) throw new Error("Invalid query status.");
  const reply = field(formData, "reply");
  const { error } = await supabase.from("helpdesk_queries").update({ status, reply: reply || null }).eq("id", field(formData, "query_id"));
  if (error) throw new Error(`Could not update query: ${error.message}`);
  revalidatePath("/");
}
