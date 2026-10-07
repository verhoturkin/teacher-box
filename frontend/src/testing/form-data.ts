/** The multipart body of a request caught by `HttpTestingController`. */
export function formData(body: unknown): FormData {
  if (!(body instanceof FormData)) {
    throw new Error('The request body is not a form');
  }
  return body;
}
