export default function EmailPreview({ subject, html, to }: { subject: string; html: string; to?: string }) {
  return <section className="admin-email-preview" aria-label="Email preview">
    <div className="admin-email-envelope"><p><span>Subject</span> {subject}</p>{to && <p><span>To</span> {to}</p>}</div>
    <iframe title="Email content preview" sandbox="" srcDoc={html} />
  </section>;
}
