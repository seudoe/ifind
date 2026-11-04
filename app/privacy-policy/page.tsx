import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy — iFind",
  description: "How iFind collects, uses, shares and protects personal data of students, employers, colleges and visitors.",
};

const EFFECTIVE = "4 November 2026";

const SECTIONS = [
  { id: "who", title: "1. Who we are" },
  { id: "collect", title: "2. Information we collect" },
  { id: "linkedin", title: "3. Sign in with LinkedIn" },
  { id: "use", title: "4. How we use information" },
  { id: "share", title: "5. Who we share it with" },
  { id: "cookies", title: "6. Cookies and similar technologies" },
  { id: "retention", title: "7. Retention" },
  { id: "security", title: "8. Security" },
  { id: "rights", title: "9. Your choices and rights" },
  { id: "children", title: "10. Age" },
  { id: "transfers", title: "11. Where data is processed" },
  { id: "changes", title: "12. Changes to this policy" },
  { id: "contact", title: "13. Contact and grievances" },
];

function H({ id, children }: { id: string; children: React.ReactNode }) {
  return <h2 id={id} className="scroll-mt-20 mt-10 mb-3 text-lg font-bold text-[var(--heading)]">{children}</h2>;
}
const P = ({ children }: { children: React.ReactNode }) => <p className="mb-3 text-sm leading-relaxed text-[var(--text-2)]">{children}</p>;
const UL = ({ children }: { children: React.ReactNode }) => <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-[var(--text-2)]">{children}</ul>;

export default function PrivacyPolicyPage() {
  // Set PRIVACY_CONTACT_EMAIL once the team has a monitored address; nothing is invented until then
  const email = process.env.PRIVACY_CONTACT_EMAIL || process.env.BREVO_SENDER_EMAIL || "";
  const site = process.env.NEXT_PUBLIC_APP_URL || "";

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 bg-[var(--bg)]">
        <div className="container-page py-10">
          <div className="mx-auto max-w-3xl">
            <p className="label mb-2">Legal</p>
            <h1 className="text-3xl font-bold text-[var(--heading)]">Privacy Policy</h1>
            <p className="mt-2 text-xs text-[var(--text-3)]">Effective {EFFECTIVE} · Last updated {EFFECTIVE}</p>

            <P>
              This policy explains what personal data iFind (&ldquo;iFind&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) collects when you use our internship platform
              {site ? <> at <span className="font-medium">{site.replace(/^https?:\/\//, "")}</span></> : null}, why we collect it, who it is shared with, and the
              choices you have. It applies to students, employers, college placement cells and moderators, and to visitors browsing without an account.
              We handle personal data in line with applicable Indian law, including the Information Technology Act, 2000 and the Digital Personal Data Protection Act, 2023.
            </P>

            <nav aria-label="Contents" className="my-6 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="label mb-2">On this page</p>
              <ul className="grid gap-1 sm:grid-cols-2">
                {SECTIONS.map((s) => (
                  <li key={s.id}><a href={`#${s.id}`} className="text-sm text-[var(--text-2)] hover:text-[var(--primary)]">{s.title}</a></li>
                ))}
              </ul>
            </nav>

            <H id="who">1. Who we are</H>
            <P>
              iFind is an internship discovery and hiring platform. Students create profiles and apply to internships; employers post internships and review applicants;
              colleges and campus coordinators can run campus internship programmes; moderators review listings. For the personal data described here,
              iFind decides how and why it is processed (a &ldquo;data fiduciary&rdquo; under the DPDP Act).
            </P>

            <H id="collect">2. Information we collect</H>
            <P><strong>Information you give us</strong></P>
            <UL>
              <li><strong>Account details:</strong> name, email address, password (stored only as a salted hash), username, and phone number where provided.</li>
              <li><strong>Student profile:</strong> gender, city, state and country, education, skills, projects, experience, links (such as GitHub or portfolio), preferred locations and internship preferences.</li>
              <li><strong>Resume:</strong> the resume file you upload and the details extracted from it. You can review and edit the extracted details.</li>
              <li><strong>Campus programme details:</strong> college name, course, year and the student ID your college assigns, when you take part in a campus internship.</li>
              <li><strong>Applications and activity:</strong> internships you save or apply to, application status, messages and notifications exchanged through the platform.</li>
              <li><strong>Employer and moderator details:</strong> company name and profile, recruiter name and work email, listings you post, and moderation decisions.</li>
              <li><strong>Support messages:</strong> anything you send us when you contact us.</li>
            </UL>
            <P><strong>Information collected automatically</strong></P>
            <UL>
              <li>Sign-in session identifiers, IP address, browser and device type, and basic request logs used for security, abuse prevention and rate limiting.</li>
              <li>Preferences such as your selected light or dark theme.</li>
            </UL>
            <P>We do not knowingly collect government ID numbers, payment card details, or precise location.</P>

            <H id="linkedin">3. Sign in with LinkedIn</H>
            <P>
              Students can register or sign in with LinkedIn, and can connect LinkedIn to an existing account. Employers can also use LinkedIn to sign in.
              When you do, LinkedIn shares data with us only after you approve it on LinkedIn&rsquo;s consent screen.
            </P>
            <UL>
              <li><strong>Profile data</strong> (scopes <code>openid</code>, <code>profile</code>, <code>email</code>): your LinkedIn member identifier, name, profile picture, email address and whether LinkedIn has confirmed that email, and locale. We use these to create or sign in to your iFind account and to pre-fill your profile.</li>
              <li><strong>Verification status</strong> (scope <code>r_verify</code>, through LinkedIn&rsquo;s &ldquo;Verified on LinkedIn&rdquo; programme): only whether LinkedIn reports that your identity (and, if available, workplace) is verified, and when we last checked. We do <strong>not</strong> receive or store your government ID, selfie or ID documents. We use the result to show your account&rsquo;s verification state and may use it to build trust features, such as a verified badge shown to employers.</li>
              <li>If you connect LinkedIn to an existing account, we replace your iFind sign-in email with your LinkedIn email after you confirm, and you can cancel before it is applied.</li>
              <li>Accounts that have both a password and LinkedIn are asked to sign in with LinkedIn at least once every 30 days to keep password sign-in active.</li>
            </UL>
            <P>
              We use LinkedIn data only for the purposes above. We do not post to your LinkedIn account, read your connections or messages, or sell LinkedIn data.
              LinkedIn&rsquo;s own handling of your data is described in the <a className="text-[var(--primary)] underline" href="https://www.linkedin.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">LinkedIn Privacy Policy</a>.
              You can withdraw iFind&rsquo;s access at any time in your LinkedIn settings (Settings &amp; Privacy &rarr; Data privacy &rarr; Permitted services).
            </P>

            <H id="use">4. How we use information</H>
            <UL>
              <li>To create and secure your account, authenticate you and prevent fraud and abuse.</li>
              <li>To build your profile, parse your resume, and match you with relevant internships and candidates.</li>
              <li>To let you apply, and to let employers review applications they receive.</li>
              <li>To run campus internship programmes with the college or coordinator you choose to join.</li>
              <li>To send service messages such as application updates, security notices and the monthly LinkedIn sign-in reminder, by email and in-app notification.</li>
              <li>To moderate listings and keep the platform free of scams.</li>
              <li>To maintain, debug, measure and improve the service.</li>
              <li>To comply with law and to establish, exercise or defend legal claims.</li>
            </UL>
            <P>We process your data on the basis of your consent and, where the law allows, for the legitimate uses listed above. We do not sell your personal data and we do not use it for third-party advertising.</P>

            <H id="share">5. Who we share it with</H>
            <UL>
              <li><strong>Employers you apply to:</strong> when you apply, the employer sees your application, your profile and your resume. Employers can also see profile information you make available for candidate search.</li>
              <li><strong>Your college or campus coordinator:</strong> for campus programmes you join, they see the details you submit for that programme.</li>
              <li><strong>Service providers that process data for us</strong>, under confidentiality and security obligations: cloud database hosting, email delivery, and AI model providers used to parse resumes and generate matching and summaries. Only the content needed for the task is sent to them.</li>
              <li><strong>LinkedIn,</strong> when you sign in or connect your account, as described above.</li>
              <li><strong>Authorities and advisers</strong> when required by law, court order or to protect rights and safety, and a successor if iFind is merged or acquired (with notice to you).</li>
            </UL>
            <P>Your phone number and account email are not shown publicly. Contact details on your recruiter-facing profile are shown only to employers you apply to or who are permitted to view candidates.</P>

            <H id="cookies">6. Cookies and similar technologies</H>
            <P>
              We use a small number of first-party cookies and browser storage that are necessary for the service: a secure, HTTP-only session cookie that keeps you signed in,
              short-lived cookies used during LinkedIn sign-in and password setup, and a stored theme preference. We do not use advertising or cross-site tracking cookies.
              You can clear or block cookies in your browser, but you will not be able to stay signed in.
            </P>

            <H id="retention">7. Retention</H>
            <P>
              We keep account and profile data while your account is active. If you delete your account, we delete or anonymise your personal data within a reasonable period,
              except what we must keep for legal, security or dispute-resolution reasons, and except copies already shared with employers or colleges, which they hold under their own policies.
              Temporary data, such as a pending LinkedIn connection or a password-setup token, expires automatically within minutes.
            </P>

            <H id="security">8. Security</H>
            <P>
              We use reasonable safeguards: passwords are hashed, sessions use signed HTTP-only cookies, traffic is encrypted in transit, sensitive actions are rate limited,
              and access to personal data is restricted to people who need it. No system is perfectly secure; if a breach affecting your data occurs, we will notify you and the
              authorities as required by law.
            </P>

            <H id="rights">9. Your choices and rights</H>
            <UL>
              <li>View and edit your profile and resume details in your dashboard at any time.</li>
              <li>Ask us to access, correct, update or erase your personal data, or to withdraw consent. Withdrawing consent may limit what the service can do for you.</li>
              <li>Nominate another person to exercise your rights in the event of your death or incapacity.</li>
              <li>Disconnect iFind from your LinkedIn account in your LinkedIn settings.</li>
              <li>Opt out of non-essential emails. Essential service and security messages will still be sent.</li>
              <li>Raise a complaint with us (section 13) and, if unresolved, with the Data Protection Board of India.</li>
            </UL>

            <H id="children">10. Age</H>
            <P>
              iFind is intended for people aged 18 and over. Where a student is under 18, an account may be created only with the verifiable consent of a parent or lawful guardian.
              We do not knowingly process the data of a child without that consent, and will delete it if we learn we have.
            </P>

            <H id="transfers">11. Where data is processed</H>
            <P>
              Our providers may store or process data on servers outside India. Where that happens we rely on providers that apply appropriate safeguards and as permitted by Indian law.
            </P>

            <H id="changes">12. Changes to this policy</H>
            <P>
              We may update this policy as the service or the law changes. We will change the date at the top and, for material changes, notify you by email or in the app.
              Continued use after a change means you accept the updated policy.
            </P>

            <H id="contact">13. Contact and grievances</H>
            <P>
              For privacy questions, requests to exercise your rights, or complaints, contact the iFind Grievance Officer
              {email ? <> at <a className="text-[var(--primary)] underline" href={`mailto:${email}`}>{email}</a></> : <> through the contact options on our website</>}.
              We aim to acknowledge requests within 72 hours and resolve them within 30 days.
            </P>

            <div className="mt-10 border-t border-[var(--border)] pt-4 text-xs text-[var(--text-3)]">
              <Link href="/user" className="hover:text-[var(--primary)]">&larr; Back to iFind</Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
