"use server";

import { pool } from "@/lib/db";
import { supabaseAdmin, getResumeSignedUrl } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase-server";
import { getOrCreateAppUser } from "@/lib/get-or-create-app-user";

async function getAuthUserId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return await getOrCreateAppUser(user);
}

export async function uploadResume(formData: FormData) {
  const file = formData.get("file") as File;
  if (!file) throw new Error("No file uploaded");

  const fileType = file.name.toLowerCase().endsWith(".pdf") ? "pdf" : 
                   file.name.toLowerCase().endsWith(".docx") ? "docx" : null;
  
  if (!fileType) throw new Error("Unsupported file type. Only PDF and DOCX are allowed.");

  const client = await pool.connect();
  try {
    const userId = await getAuthUserId();
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = `${userId}/${fileName}`;

    // Upload to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: storageError } = await supabaseAdmin.storage
      .from("resumes")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (storageError) throw storageError;

    // Insert into DB
    const res = await client.query(
      `INSERT INTO resumes (user_id, file_path, file_type) 
       VALUES ($1, $2, $3) RETURNING id`,
      [userId, filePath, fileType]
    );

    // Set as active resume
    await client.query(
      "UPDATE users SET active_resume_id = $1 WHERE id = $2",
      [res.rows[0].id, userId]
    );

    // Call grading service to parse and embed the resume synchronously
    try {
      const parseUrl = `${process.env.GRADING_SERVICE_URL || 'http://127.0.0.1:5000'}/parse-document`;
      const parseRes = await fetch(parseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "resume", id: res.rows[0].id }),
      });
      
      if (!parseRes.ok) {
        const errorData = await parseRes.json().catch(() => ({}));
        throw new Error(`Parsing failed with status ${parseRes.status}: ${errorData.error || 'Unknown error'}`);
      }
    } catch (parseError: any) {
      console.error("Error calling parse-document endpoint:", parseError);
      throw new Error(`Resume uploaded successfully, but parsing failed: ${parseError.message}`);
    }

  } catch (error) {
    console.error("Error uploading resume:", error);
    throw error;
  } finally {
    client.release();
    revalidatePath("/dashboard/library");
  }
}

export async function deleteResume(resumeId: string, filePath: string) {
  const client = await pool.connect();
  try {
    // Delete from Supabase Storage
    const { error: storageError } = await supabaseAdmin.storage
      .from("resumes")
      .remove([filePath]);

    if (storageError) console.error("Error deleting from storage:", storageError);

    // Delete from DB (active_resume_id is SET NULL on delete)
    await client.query("DELETE FROM resumes WHERE id = $1", [resumeId]);
  } catch (error) {
    console.error("Error deleting resume:", error);
    throw error;
  } finally {
    client.release();
    revalidatePath("/dashboard/library");
  }
}

export async function setActiveResume(resumeId: string) {
  const client = await pool.connect();
  try {
    const userId = await getAuthUserId();
    await client.query(
      "UPDATE users SET active_resume_id = $1 WHERE id = $2",
      [resumeId, userId]
    );
  } catch (error) {
    console.error("Error setting active resume:", error);
    throw error;
  } finally {
    client.release();
    revalidatePath("/dashboard/library");
  }
}

export async function getSignedUrl(filePath: string) {
  return await getResumeSignedUrl(filePath);
}

export async function saveJobDescription(formData: FormData) {
  const title = formData.get("title")?.toString();
  const company = formData.get("company")?.toString() || null;
  const rawText = formData.get("rawText")?.toString();

  if (!title || !rawText) throw new Error("Title and Job Description text are required");

  const client = await pool.connect();
  try {
    const userId = await getAuthUserId();

    const res = await client.query(
      `INSERT INTO job_descriptions (user_id, title, company, raw_text) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [userId, title, company, rawText]
    );

    // Set as active JD
    await client.query(
      "UPDATE users SET active_jd_id = $1 WHERE id = $2",
      [res.rows[0].id, userId]
    );

    // Call grading service to embed the JD synchronously
    try {
      const parseUrl = `${process.env.GRADING_SERVICE_URL || 'http://127.0.0.1:5000'}/parse-document`;
      const parseRes = await fetch(parseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "job_description", id: res.rows[0].id }),
      });
      
      if (!parseRes.ok) {
        const errorData = await parseRes.json().catch(() => ({}));
        throw new Error(`Embedding failed with status ${parseRes.status}: ${errorData.error || 'Unknown error'}`);
      }
    } catch (parseError: any) {
      console.error("Error calling parse-document endpoint for JD:", parseError);
      throw new Error(`Job description saved successfully, but embedding failed: ${parseError.message}`);
    }

  } catch (error) {
    console.error("Error saving JD:", error);
    throw error;
  } finally {
    client.release();
    revalidatePath("/dashboard/library");
  }
}

export async function deleteJobDescription(jdId: string) {
  const client = await pool.connect();
  try {
    await client.query("DELETE FROM job_descriptions WHERE id = $1", [jdId]);
  } catch (error) {
    console.error("Error deleting JD:", error);
    throw error;
  } finally {
    client.release();
    revalidatePath("/dashboard/library");
  }
}

export async function setActiveJobDescription(jdId: string) {
  const client = await pool.connect();
  try {
    const userId = await getAuthUserId();
    await client.query(
      "UPDATE users SET active_jd_id = $1 WHERE id = $2",
      [jdId, userId]
    );
  } catch (error) {
    console.error("Error setting active JD:", error);
    throw error;
  } finally {
    client.release();
    revalidatePath("/dashboard/library");
  }
}
