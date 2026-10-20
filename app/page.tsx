import type { User } from "@supabase/supabase-js";
import SubmitButton from "./submit-button";
import { createFolder, createQuestion, createQuiz, deleteNote, deleteQuestion, deleteQuiz, openNote, signIn, signOut, submitAnswer, submitHelpdesk, updateQueryStatus, uploadNote } from "./actions";
import { createClient, isAdminEmail } from "@/lib/supabase/server";

type Question = { id: string; prompt: string; kind: "choice" | "integer" | "number"; options: string[] | null; quiz_id: string };
type Quiz = { id: string; title: string; description: string | null };
type Folder = { id: string; name: string };
type StudyFile = { id: string; folder_id: string; name: string; storage_path: string };
type Answer = { question_id: string; is_correct: boolean };
type HelpQuery = {
  id: string; subject: string; message: string; reply: string | null; status: string; user_id: string;
};
type Member = { id: string; email: string; current_streak: number; best_streak: number };

function Logo({ signedIn }: { signedIn: boolean }) {
  return <details className="brand-menu">
    <summary className="brand" aria-label="Open AI STUDY menu"><span className="logo">✦</span><span><strong>AI STUDY</strong><small>LEARN BEYOND LIMITS</small></span><span className="menu-caret">⌄</span></summary>
    <div className="brand-menu-panel"><a href="#dashboard">Dashboard</a><a href="#notes">Notes &amp; books</a><a href="#questions">Practice arena</a><a href="#quizzes">Quizzes</a><a href={signedIn ? "#helpdesk" : "#signin"}>Helpdesk</a></div>
  </details>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  let user: User | null = null;
  let admin = false;
  let quizzes: Quiz[] = [];
  let questions: Question[] = [];
  let folders: Folder[] = [];
  let files: StudyFile[] = [];
  let profile: { current_streak: number; best_streak: number } | null = null;
  let answers: Answer[] = [];
  let queries: HelpQuery[] = [];
  let members: Member[] = [];
  let loadError = "";

  if (supabase) {
    const { data: auth } = await supabase.auth.getUser();
    user = auth.user;
    admin = Boolean(user?.email_confirmed_at && isAdminEmail(user.email));
    const [quizResult, folderResult] = await Promise.all([
      supabase.from("quizzes").select("id,title,description").eq("is_active", true).order("created_at", { ascending: false }),
      supabase.from("note_folders").select("id,name").order("name"),
    ]);
    quizzes = quizResult.data || [];
    folders = folderResult.data || [];
    if (quizResult.error || folderResult.error) loadError = "Could not load content. Check Supabase configuration and apply the database migration.";

    const [questionResult, fileResult] = await Promise.all([
      quizzes.length
        ? supabase.from("quiz_questions").select("id,prompt,kind,options,quiz_id").in("quiz_id", quizzes.map((quiz) => quiz.id)).order("created_at")
        : Promise.resolve({ data: [], error: null }),
      supabase.from("note_files").select("id,folder_id,name,storage_path").order("created_at", { ascending: false }),
    ]);
    questions = (questionResult.data || []) as Question[];
    files = fileResult.data || [];
    if (questionResult.error || fileResult.error) loadError = "Could not load questions or study files.";

    if (user) {
      const [profileResult, answerResult] = await Promise.all([
        supabase.from("profiles").select("current_streak,best_streak").eq("id", user.id).maybeSingle(),
        supabase.from("user_answers").select("question_id,is_correct").eq("user_id", user.id),
      ]);
      profile = profileResult.data;
      answers = answerResult.data || [];
      if (profileResult.error || answerResult.error) loadError = "Could not load your saved progress.";

      if (admin) {
        const [queryResult, memberResult] = await Promise.all([
          supabase.from("helpdesk_queries").select("id,subject,message,reply,status,user_id").order("created_at", { ascending: false }),
          supabase.from("profiles").select("id,email,current_streak,best_streak").order("best_streak", { ascending: false }),
        ]);
        queries = (queryResult.data || []) as HelpQuery[];
        members = memberResult.data || [];
        if (queryResult.error || memberResult.error) loadError = "Could not load administrator data.";
      } else {
        const { data, error } = await supabase.from("helpdesk_queries")
          .select("id,subject,message,reply,status,user_id").eq("user_id", user.id).order("created_at", { ascending: false });
        queries = data || [];
        if (error) loadError = "Could not load your support requests.";
      }
    }
  }

  const answered = new Set(answers.map((answer) => answer.question_id));
  const correct = answers.filter((answer) => answer.is_correct).length;
  const activeQuestions = questions.length;
  const openQueries = queries.filter((query) => query.status === "open").length;
  const learnerName = typeof user?.user_metadata?.full_name === "string"
    ? user.user_metadata.full_name
    : user?.email?.split("@")[0] || "learner";

  return (
    <main className="shell">
      <header className="topbar">
        <Logo signedIn={Boolean(user)} />
        <div className="top-actions">
          <span className="pill" id="userPill">{user ? user.email : "Guest mode"}</span>
          {admin && <a className="primary" href="#admin">Admin tools</a>}
          {user ? <form action={signOut}><SubmitButton className="ghost" pendingText="Signing out…">Sign out</SubmitButton></form> : <a className="ghost" href="#signin">Sign in</a>}
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="side-label">Workspace</div>
          <a className="navbtn active" href="#dashboard"><span>▦</span> Dashboard</a>
          <a className="navbtn" href="#questions"><span>⌘</span> Practice arena</a>
          <a className="navbtn" href="#notes"><span>▤</span> Notes &amp; books</a>
          <a className="navbtn" href="#quizzes"><span>◉</span> Quizzes</a>
          <a className="navbtn" href={user ? "#helpdesk" : "#signin"}><span>✉</span> Helpdesk</a>
          <div className="side-label">Account</div>
          <a className="navbtn" href={user ? "#dashboard" : "#signin"}><span>◎</span> {user ? "Account" : "Profile & sign in"}</a>
          {admin && <a className="navbtn" href="#admin"><span>⚙</span> Admin workspace</a>}
          <div className="side-note">✦ <b>Focus mode</b><br />Learn a little every day. Every correct answer builds your streak; a wrong answer resets it.</div>
        </aside>

        <div className="main">
          <section className="welcome" id="dashboard">
            <div><div className="eyebrow">Your learning command center</div><h1>{user ? `Welcome back, ${learnerName}.` : "Welcome, learner."}</h1><p>{user ? "Your progress at a glance. Keep learning one answer at a time." : "Practice consistently. Track progress. Keep your streak alive."}</p></div>
            <span className="tag">{admin ? <span className="admin-chip">ADMIN MODE</span> : "✦ STUDENT SPACE"}</span>
          </section>

          {params.error && <div className="notice" role="alert">{params.error}</div>}
          {loadError && <div className="notice" role="alert">{loadError}</div>}
          {!supabase && <div className="notice"><b>Setup needed.</b> Add Supabase values from <code>.env.example</code> and apply <code>supabase/migrations/001_initial.sql</code> for sign-in and saved progress.</div>}

          <section className="dashboard-section" aria-label="Study dashboard">
            {admin ? <>
              <div className="grid">
                <article className="card stat"><div className="label">Registered learners</div><div className="value accent">{members.length}</div><div className="sub">Accounts in your study space</div></article>
                <article className="card stat"><div className="label">Practice questions</div><div className="value">{activeQuestions}</div><div className="sub">Currently published</div></article>
                <article className="card stat"><div className="label">Helpdesk queries</div><div className="value pink">{queries.length}</div><div className="sub">{openQueries} waiting for a response</div></article>
              </div>
              <div className="content-grid">
                <section className="card"><div className="section-head"><div><h2>Learner activity</h2><p>Current and personal-best streaks</p></div><span className="badge">ADMIN ONLY</span></div>
                  {members.length ? <div className="list">{members.map((member) => <div className="list-item" key={member.id}><div><strong>{member.email}</strong><small>Study member</small></div><div className="member-stats"><b className="accent">{member.current_streak} 🔥</b><small>Best {member.best_streak}</small></div></div>)}</div> : <Empty>No learners yet. Their profiles will appear after they sign in.</Empty>}
                </section>
                <section className="card"><h2>Quick actions</h2><p className="muted">Manage study content and respond to learners.</p><div className="formstack quick-actions"><a className="primary" href="#questions">＋ Add question</a><a className="ghost" href="#notes">＋ Upload notes / books</a><a className="ghost" href="#quizzes">＋ Create quiz</a><a className="ghost" href="#helpdesk">Open helpdesk ({openQueries} open)</a></div></section>
              </div>
              <section className="card"><div className="section-head"><div><h2>Recent queries</h2><p>Latest learner support requests</p></div><a className="inline-link" href="#helpdesk">View helpdesk →</a></div>
                {queries.length ? <div className="list">{queries.slice(0, 4).map((query) => <div className="list-item" key={query.id}><div><strong>{query.subject}</strong><small>{members.find((member) => member.id === query.user_id)?.email || query.user_id} · {query.message}</small></div><span className="badge">{query.status}</span></div>)}</div> : <Empty>No queries submitted yet.</Empty>}
              </section>
            </> : <>
              <div className="grid">
                <article className="card stat"><div className="label">Current streak</div><div className="value accent">{profile?.current_streak ?? 0} 🔥</div><div className="sub">Correct answers in a row</div></article>
                <article className="card stat"><div className="label">Highest streak</div><div className="value green">{profile?.best_streak ?? 0} ✦</div><div className="sub">Your personal best</div></article>
                <article className="card stat"><div className="label">Correct answers</div><div className="value">{correct}</div><div className="sub">{answers.length} total attempts</div></article>
              </div>
              <div className="content-grid">
                <div>
                  <section className="card"><div className="section-head"><div><h2>Practice arena</h2><p>One wrong answer resets your current streak.</p></div><span className="badge">{activeQuestions} LIVE</span></div>
                    <div className="streak-banner"><div><small>YOUR CURRENT RUN</small><strong>{profile?.current_streak ?? 0} <span>correct in a row</span></strong></div><div className="best-streak"><small>PERSONAL BEST</small><strong className="accent">{profile?.best_streak ?? 0}</strong></div></div>
                    <a className="primary action-spaced" href="#questions">Start practising →</a>
                  </section>
                  <section className="card"><div className="section-head"><div><h2>Study library</h2><p>Notes and books shared by the admin</p></div><span className="badge">{files.length} FILES</span></div>
                    {files.length ? <div className="list">{files.slice(0, 3).map((file) => <div className="list-item" key={file.id}><div><strong>▤ {file.name}</strong><small>{folders.find((folder) => folder.id === file.folder_id)?.name || "Study files"}</small></div><a className={`ghost ${!user ? "disabled-link" : ""}`} href="#notes">{user ? "Open library" : "Sign in"}</a></div>)}</div> : <Empty>Study materials will appear here when the admin uploads them.</Empty>}
                    <a className="ghost action-spaced" href="#notes">Browse library →</a>
                  </section>
                </div>
                <div>
                  <section className="card"><h2>Quiz progress</h2><p className="muted">Questions answered: <b className="accent">{answers.length}</b></p><div className="progress"><span style={{ width: `${questions.length ? Math.min(100, answers.length / questions.length * 100) : 0}%` }} /></div><a className="ghost full-width action-spaced" href="#quizzes">Explore quizzes</a></section>
                  <section className="card"><h2>Need help?</h2><p className="muted">Send a question, report a problem, or request a topic.</p><a className="ghost full-width" href={user ? "#helpdesk" : "#signin"}>Open helpdesk →</a></section>
                </div>
              </div>
            </>}
          </section>

          {!user && <section className="card" id="signin"><div className="section-head"><div><h2>Sign in to save your progress</h2><p>Continue securely with your existing account.</p></div><span className="badge">SECURE SIGN-IN</span></div>
            <form action={signIn} className="provider-grid"><SubmitButton name="provider" value="google" className="ghost oauth" pendingText="Connecting…">G&nbsp; Continue with Google</SubmitButton><SubmitButton name="provider" value="facebook" className="ghost oauth" pendingText="Connecting…">f&nbsp; Continue with Facebook</SubmitButton><SubmitButton name="provider" value="apple" className="ghost oauth" pendingText="Connecting…">●&nbsp; Continue with Apple</SubmitButton></form>
            <p className="muted fine-print">Google, Facebook, and Apple sign-in require provider credentials and callback URLs configured in Supabase.</p>
          </section>}

          <section className="card" id="questions"><div className="section-head"><div><h2>Practice arena</h2><p>Correct answers extend your streak; a wrong answer resets it.</p></div><span className="badge">{questions.length} QUESTIONS</span></div>
            {admin && <div className="admin-form-wrap"><div className="section-head"><div><h2>Publish a question</h2><p>Correct answers are checked securely on the server.</p></div><span className="admin-chip">ADMIN</span></div>
              <form action={createQuestion} className="formstack"><label><span className="label">Quiz</span><select className="field" name="quiz_id" required>{quizzes.map((quiz) => <option value={quiz.id} key={quiz.id}>{quiz.title}</option>)}</select></label><label><span className="label">Question</span><textarea className="field" name="prompt" placeholder="Write the question shown to visitors" rows={2} required maxLength={1000} /></label><div className="formrow"><label><span className="label">Answer format</span><select className="field" name="kind"><option value="integer">Integer</option><option value="number">Optional / decimal number</option><option value="choice">Multiple choice</option></select></label><label><span className="label">Correct answer</span><input className="field" name="correct_answer" required /></label></div><label><span className="label">Choices (one per line; for multiple choice)</span><textarea className="field" name="options" rows={3} /></label><SubmitButton className="primary" disabled={!quizzes.length} pendingText="Publishing…">Publish question</SubmitButton></form>
            </div>}
            {questions.length ? questions.map((question, index) => {
              const options = question.options || [];
              const wasAnswered = answered.has(question.id);
              const wasCorrect = answers.find((answer) => answer.question_id === question.id)?.is_correct;
              return <article className="question-card" key={question.id}><div className="section-head"><div><span className="badge">{question.kind === "choice" ? "Multiple choice" : question.kind === "integer" ? "Integer" : "Decimal / numeric"}</span><h3 className="question-title">Question {index + 1}</h3></div><div className="question-admin-actions">{wasAnswered && <span className={`badge ${wasCorrect ? "correct-badge" : "wrong-badge"}`}>{wasCorrect ? "Correct ✓" : "Incorrect · streak reset"}</span>}{admin && <form action={deleteQuestion}><input type="hidden" name="question_id" value={question.id} /><SubmitButton className="ghost compact-button" pendingText="Deleting…">Delete</SubmitButton></form>}</div></div><p>{question.prompt}</p>
                <form action={submitAnswer} className="answer-form"><input type="hidden" name="question_id" value={question.id} />
                  {question.kind === "choice" ? <div className="choices">{options.map((option) => <label className="choice" key={option}><input type="radio" name="answer" value={option} required disabled={!user || wasAnswered} /><span>{option}</span></label>)}</div> : <input className="field" name="answer" type="number" step={question.kind === "integer" ? "1" : "any"} placeholder={question.kind === "integer" ? "Enter an integer" : "Enter a number"} required disabled={!user || wasAnswered} />}
                  {user ? <SubmitButton className="primary" disabled={wasAnswered} pendingText="Checking…">{wasAnswered ? (wasCorrect ? "Answer recorded ✓" : "Answer recorded — streak reset") : "Check answer"}</SubmitButton> : <a className="ghost" href="#signin">Sign in to answer</a>}
                </form>
              </article>;
            }) : <Empty>No questions have been published yet.</Empty>}
          </section>

          <section className="card" id="notes"><div className="section-head"><div><h2>Notes &amp; books</h2><p>A shared study library organised into folders.</p></div><span className="badge">{files.length} RESOURCES</span></div>
            {admin && <div className="admin-form-wrap"><div className="section-head"><div><h2>Manage study library</h2><p>Create a subject folder and upload a resource for learners.</p></div><span className="admin-chip">ADMIN</span></div>
              <form action={createFolder} className="formrow"><input className="field" name="name" maxLength={100} placeholder="New folder or subject" required /><SubmitButton className="primary" pendingText="Creating…">Create folder</SubmitButton></form>
              <form action={uploadNote} className="formstack admin-upload"><label><span className="label">Folder</span><select className="field" name="folder_id" required>{folders.map((folder) => <option value={folder.id} key={folder.id}>{folder.name}</option>)}</select></label><label><span className="label">Choose file (max 20 MB)</span><input className="field" type="file" name="file" required /></label><SubmitButton className="primary" disabled={!folders.length} pendingText="Uploading…">Upload resource</SubmitButton></form>
            </div>}
            {folders.length ? <div className="folder-grid">{folders.map((folder) => <article className="folder-card" key={folder.id}><div className="folder-heading"><strong>▱ &nbsp;{folder.name}</strong><span className="badge">{files.filter((file) => file.folder_id === folder.id).length} files</span></div>
              {files.filter((file) => file.folder_id === folder.id).length ? <div className="list">{files.filter((file) => file.folder_id === folder.id).map((file) => <div className="list-item" key={file.id}><div><strong>▤ {file.name}</strong><small>Study resource</small></div><div className="file-actions"><form action={openNote}><input type="hidden" name="path" value={file.storage_path} /><SubmitButton className="ghost" disabled={!user} pendingText="Opening…">{user ? "Open ↗" : "Sign in"}</SubmitButton></form>{admin && <form action={deleteNote}><input type="hidden" name="file_id" value={file.id} /><input type="hidden" name="path" value={file.storage_path} /><SubmitButton className="ghost compact-button" pendingText="Removing…">Remove</SubmitButton></form>}</div></div>)}</div> : <p className="muted">No files in this folder yet.</p>}
            </article>)}</div> : <Empty>Nothing here yet. The admin can create folders and upload books, notes, and study files.</Empty>}
          </section>

          <section className="card" id="quizzes"><div className="section-head"><div><h2>Quizzes</h2><p>Practice questions are grouped into quizzes. Your responses update your dashboard.</p></div><span className="badge">{quizzes.length} QUIZZES</span></div>
            {admin && <div className="admin-form-wrap"><div className="section-head"><div><h2>Create a quiz</h2><p>Add a focused practice set for learners.</p></div><span className="admin-chip">ADMIN</span></div>
              <form action={createQuiz} className="formstack"><input className="field" name="title" placeholder="Quiz title" required maxLength={120} /><textarea className="field" name="description" placeholder="Short description" rows={2} maxLength={500} /><SubmitButton className="primary" pendingText="Publishing…">Publish quiz</SubmitButton></form>
            </div>}
            {quizzes.length ? <div className="list">{quizzes.map((quiz) => {
              const items = questions.filter((question) => question.quiz_id === quiz.id);
              const completed = items.filter((question) => answered.has(question.id)).length;
              return <article className="list-item quiz-list-item" key={quiz.id}><div><strong>{quiz.title}</strong><small>{quiz.description || "Practice set"} · {items.length} questions</small><div className="progress"><span style={{ width: `${items.length ? completed / items.length * 100 : 0}%` }} /></div></div><div className="quiz-actions"><a className="ghost" href="#questions">Practice →</a>{admin && <form action={deleteQuiz}><input type="hidden" name="quiz_id" value={quiz.id} /><SubmitButton className="ghost compact-button" pendingText="Deleting…">Delete</SubmitButton></form>}</div></article>;
            })}</div> : <Empty>No quizzes yet. Check back soon.</Empty>}
          </section>

          {user && <section className="content-grid" id="helpdesk">
            <article className="card"><div className="section-head"><div><h2>Send a query</h2><p>Ask a question, report an issue, or request a topic.</p></div><span className="badge">SUPPORT</span></div>
              <form action={submitHelpdesk} className="formstack"><label><span className="label">Subject</span><input className="field" name="subject" maxLength={120} placeholder="What do you need help with?" required /></label><label><span className="label">Your query</span><textarea className="field" name="message" rows={5} maxLength={4000} placeholder="Write your query..." required /></label><SubmitButton className="primary" pendingText="Sending…">Send query</SubmitButton></form>
            </article>
            <article className="card"><h2>{admin ? "Incoming queries" : "Your support requests"}</h2><p className="muted">{admin ? "Review and resolve learner requests." : "Your submitted requests appear here."}</p>
              {queries.length ? <div className="list">{queries.map((query) => <div className="list-item query-item" key={query.id}><div><strong>{query.subject}</strong><small>{admin ? members.find((member) => member.id === query.user_id)?.email || query.user_id : query.status}</small><p>{query.message}</p>{!admin && query.reply && <div className="notice">Admin reply: {query.reply}</div>}{admin && <form action={updateQueryStatus} className="query-reply-form"><input type="hidden" name="query_id" value={query.id} /><label><span className="label">Admin reply</span><textarea className="field" name="reply" rows={2} defaultValue={query.reply || ""} placeholder="Write a reply..." /></label><div className="formrow"><select className="field" name="status" defaultValue={query.status}><option value="open">Open</option><option value="resolved">Resolved</option></select><SubmitButton className="ghost" pendingText="Saving…">Save reply / status</SubmitButton></div></form>}</div><span className="badge">{query.status}</span></div>)}</div> : <Empty>No requests yet.</Empty>}
            </article>
          </section>}

          {admin && <section className="card" id="admin"><div className="section-head"><div><h2>Administrator tools</h2><p>Management access is verified against your configured admin email and database policies.</p></div><span className="admin-chip">ADMIN ONLY</span></div><a className="ghost" href="#dashboard">Back to dashboard ↑</a></section>}
          {!user && <section className="card sign-in-reminder"><h2>Ready to keep your streak going?</h2><p className="muted">Sign in to answer questions, track progress, and send your queries.</p><a className="primary" href="#signin">Sign in securely →</a></section>}
          <footer className="footer">AI STUDY · Built for curious minds · Your progress is saved securely to your account.</footer>
        </div>
      </div>
    </main>
  );
}
