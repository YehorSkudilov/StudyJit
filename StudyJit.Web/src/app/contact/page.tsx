export default function ContactPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-6">
      <div className="card p-8 max-w-lg w-full text-center">
        <h2 className="text-3xl font-bold text-gradient mb-4">
          Contact Us
        </h2>
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          We&apos;d love to hear from you! Send your feedback, questions, or suggestions below.
        </p>

        <form className="space-y-4">
          <input
            type="text"
            placeholder="Your Name"
            className="input"
          />
          <input
            type="email"
            placeholder="Your Email"
            className="input"
          />
          <textarea
            placeholder="Your Message"
            rows={5}
            className="input resize-none"
          />
          <button
            type="submit"
            className="btn-primary w-full py-3"
          >
            Send Message
          </button>
        </form>
      </div>
    </div>
  );
}
