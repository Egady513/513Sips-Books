import { parseAllowedEmails } from './allowList'

export const requireBooksLogin = import.meta.env.VITE_REQUIRE_LOGIN === 'true'
export const booksAllowedEmails = parseAllowedEmails(import.meta.env.VITE_BOOKS_ALLOWED_EMAILS)
