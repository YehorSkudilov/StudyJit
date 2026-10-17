export default function ContactPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100 px-6">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg max-w-lg w-full text-center">
        <h2 className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-4">
          Contact Us
        </h2>
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          We'd love to hear from you! Send your feedback, questions, or suggestions below.
        </p>

        <form className="space-y-4">
          <input
            type="text"
            placeholder="Your Name"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:ring-2 focus:ring-blue-400"
          />
          <input
            type="email"
            placeholder="Your Email"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:ring-2 focus:ring-blue-400"
          />
          <textarea
            placeholder="Your Message"
            rows={5}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:ring-2 focus:ring-blue-400 resize-none"
          />
          <button
            type="submit"
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 transition"
          >
            Send Message
          </button>
        </form>
      </div>
    </div>
  );
}
