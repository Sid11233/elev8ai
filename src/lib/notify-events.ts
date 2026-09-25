import "server-only";

import { track } from "@/lib/analytics";
import { createAdminClient } from "@/lib/supabase/admin";

import { getAdminUserIds, notify, notifyMany } from "./notify";

// Each function looks up what it needs with the service role and fires the
// right notifications. Called from server actions after the DB change succeeds.
// Failures are swallowed inside notify(), so these never break the action.

// applications.user_id and profiles.user_id both reference auth.users, so
// PostgREST can't embed the profile directly — fetch the name separately.
async function nameOf(userId: string): Promise<string> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", userId)
    .single();
  return data?.full_name ?? "Someone";
}

export async function notifyNewApplication(applicationId: string) {
  const supabase = createAdminClient();
  const { data: app } = await supabase
    .from("applications")
    .select("id, user_id, job:jobs(title)")
    .eq("id", applicationId)
    .single();
  if (!app?.job) return;
  const [name, admins] = await Promise.all([nameOf(app.user_id), getAdminUserIds()]);
  await notifyMany(admins, {
    type: "application_new",
    title: "New job application",
    body: `${name} applied for "${app.job.title}".`,
    link: "/admin/applications",
  });
}

export async function notifyApplicationDecision(applicationId: string, accepted: boolean) {
  const supabase = createAdminClient();
  const { data: app } = await supabase
    .from("applications")
    .select("user_id, decision_note, job:jobs(id, title)")
    .eq("id", applicationId)
    .single();
  if (!app?.job) return;
  if (accepted) track("job_accepted", app.user_id, { job_id: app.job.id });
  await notify({
    userId: app.user_id,
    type: accepted ? "application_accepted" : "application_rejected",
    title: accepted ? "You're in!" : "Application update",
    body: accepted
      ? `You've been accepted for "${app.job.title}". Submit your work when it's ready.`
      : `You weren't selected for "${app.job.title}" this time.${app.decision_note ? ` Note: ${app.decision_note}` : ""}`,
    link: accepted ? `/app/my-jobs/${applicationId}` : `/app/jobs/${app.job.id}`,
  });
}

export async function notifyNewSubmission(applicationId: string) {
  const supabase = createAdminClient();
  const { data: app } = await supabase
    .from("applications")
    .select("user_id, job:jobs(title)")
    .eq("id", applicationId)
    .single();
  if (!app?.job) return;
  const [name, admins] = await Promise.all([nameOf(app.user_id), getAdminUserIds()]);
  await notifyMany(admins, {
    type: "submission_new",
    title: "New work to review",
    body: `${name} submitted work for "${app.job.title}".`,
    link: "/admin/submissions",
  });
}

export async function notifySubmissionReviewed(
  submissionId: string,
  decision: "approved" | "changes_requested" | "rejected",
) {
  const supabase = createAdminClient();
  const { data: sub } = await supabase
    .from("submissions")
    .select("user_id, reviewer_note, application:applications(id, job:jobs(title))")
    .eq("id", submissionId)
    .single();
  const job = sub?.application?.job;
  if (!sub || !job) return;
  if (decision === "approved") track("submission_approved", sub.user_id, { job: job.title });

  const map = {
    approved: {
      title: "Work approved 🎉",
      body: `Your work for "${job.title}" was approved. Your payout is on the way.`,
    },
    changes_requested: {
      title: "Changes requested",
      body: `Please update your work for "${job.title}".${sub.reviewer_note ? ` ${sub.reviewer_note}` : ""}`,
    },
    rejected: {
      title: "Work not approved",
      body: `Your work for "${job.title}" wasn't approved.${sub.reviewer_note ? ` ${sub.reviewer_note}` : ""}`,
    },
  } as const;

  await notify({
    userId: sub.user_id,
    type: `submission_${decision}`,
    title: map[decision].title,
    body: map[decision].body,
    link: `/app/my-jobs/${sub.application?.id}`,
  });
}

export async function notifyPayoutsPaid(payoutIds: string[]) {
  if (!payoutIds.length) return;
  const supabase = createAdminClient();
  const { data: payouts } = await supabase
    .from("payouts")
    .select("user_id, amount_cents")
    .in("id", payoutIds)
    .eq("status", "paid");
  // One summary notification per person.
  const byUser = new Map<string, number>();
  for (const p of payouts ?? [])
    byUser.set(p.user_id, (byUser.get(p.user_id) ?? 0) + p.amount_cents);
  await Promise.all(
    [...byUser.entries()].map(([userId, cents]) => {
      track("payout_paid", userId, { amount_cents: cents });
      return notify({
        userId,
        type: "payout_paid",
        title: "You've been paid 💸",
        body: `A payout of $${(cents / 100).toFixed(2)} has been sent. Check your account.`,
        link: "/app/earnings",
      });
    }),
  );
}

// New message: notify the other side, but email at most once per thread per hour.
export async function notifyNewMessage(conversationId: string, senderId: string) {
  const supabase = createAdminClient();
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, application:applications(user_id, job:jobs(title))")
    .eq("id", conversationId)
    .single();
  const app = conv?.application;
  if (!app?.job) return;

  const senderIsTalent = senderId === app.user_id;
  const jobTitle = app.job.title;

  // Recent email to this recipient about this thread? Then skip the email.
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  if (senderIsTalent) {
    // Notify all admins.
    const admins = await getAdminUserIds();
    for (const adminId of admins) {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", adminId)
        .eq("type", "message_new")
        .eq("link", `/admin/messages/${conversationId}`)
        .gte("emailed_at", hourAgo);
      await notify({
        userId: adminId,
        type: "message_new",
        title: `New message about "${jobTitle}"`,
        body: "You have a new message from talent.",
        link: `/admin/messages/${conversationId}`,
        skipEmail: (count ?? 0) > 0,
      });
    }
  } else {
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", app.user_id)
      .eq("type", "message_new")
      .eq("link", `/app/messages/${conversationId}`)
      .gte("emailed_at", hourAgo);
    await notify({
      userId: app.user_id,
      type: "message_new",
      title: `New message about "${jobTitle}"`,
      body: "You have a new message from the Elev8ai team.",
      link: `/app/messages/${conversationId}`,
      skipEmail: (count ?? 0) > 0,
    });
  }
}

// New open job: notify talent who have worked in that category before
// (an accepted application to a job in the same category).
export async function notifyNewJob(jobId: string) {
  const supabase = createAdminClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, title, category, company:companies(name)")
    .eq("id", jobId)
    .single();
  if (!job) return;

  const { data: rows } = await supabase
    .from("applications")
    .select("user_id, job:jobs!inner(category)")
    .eq("status", "accepted")
    .eq("jobs.category", job.category);
  const userIds = [...new Set((rows ?? []).map((r) => r.user_id))];
  if (!userIds.length) return;

  await notifyMany(userIds, {
    type: "job_new",
    title: "New job you might like",
    body: `${job.company?.name ?? "A company"} posted "${job.title}".`,
    link: `/app/jobs/${job.id}`,
  });
}

export async function notifyNewAssignment(courseId: string) {
  const supabase = createAdminClient();
  const { data: course } = await supabase
    .from("courses")
    .select("title")
    .eq("id", courseId)
    .single();
  const admins = await getAdminUserIds();
  await notifyMany(admins, {
    type: "assignment_new",
    title: "New assignment to grade",
    body: course
      ? `Someone submitted the ${course.title} assignment.`
      : "A new assignment is ready to grade.",
    link: "/admin/grading",
  });
}

export async function notifyAssignmentGraded(assignmentId: string, passed: boolean) {
  const supabase = createAdminClient();
  const { data: asg } = await supabase
    .from("course_assignments")
    .select("user_id, feedback, course:courses(title, slug)")
    .eq("id", assignmentId)
    .single();
  const course = asg?.course;
  if (!asg || !course) return;
  if (passed) track("assignment_passed", asg.user_id, { course: course.title });
  await notify({
    userId: asg.user_id,
    type: passed ? "assignment_passed" : "assignment_failed",
    title: passed ? "You passed! 🏅" : "Assignment needs another go",
    body: passed
      ? `You passed the ${course.title} assignment and earned your badge.`
      : `Your ${course.title} assignment wasn't passed.${asg.feedback ? ` ${asg.feedback}` : ""}`,
    link: `/app/learn/${course.slug}`,
  });
}

// Badge awarded (by grading or manually): point the user at the jobs it unlocks.
export async function notifyBadgeAwarded(userId: string, skillId: string) {
  const supabase = createAdminClient();
  const { data: skill } = await supabase.from("skills").select("name").eq("id", skillId).single();
  if (!skill) return;
  const { count } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "open")
    .eq("required_skill_id", skillId);
  await notify({
    userId,
    type: "badge_awarded",
    title: `You earned the ${skill.name} badge 🎉`,
    body:
      (count ?? 0) > 0
        ? `You've unlocked ${count} ${count === 1 ? "job" : "jobs"}. Take a look!`
        : "New jobs needing this badge will now be open to you.",
    link: `/app/jobs?badge=${skillId}`,
  });
}
