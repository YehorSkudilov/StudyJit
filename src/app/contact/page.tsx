export default function ContactPage() {
  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="w-full max-w-md text-white">
        <h1 className="text-3xl font-bold mb-4 text-center">Contact Us</h1>
        <p className="mb-6 text-lg text-center">
          {"We'd love to hear from you! Reach out with questions, feedback, or suggestions."}
        </p>
        <form className="space-y-4">
          <input
            type="text"
            placeholder="Your Name"
            className="w-full px-4 py-2 rounded text-white border border-white focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <input
            type="email"
            placeholder="Your Email"
            className="w-full px-4 py-2 rounded text-white border borderwhite focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <textarea
            placeholder="Your Message"
            rows={5}
            className="w-full px-4 py-2 rounded text-white border borderwhite focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          />
          <button
            type="submit"
            className="w-full py-2 bg-green-600 text-white font-semibold rounded hover:bg-green-700 transition"
          >
            Send Message
          </button>
        </form>
      </div>
    </div>
  );
}
