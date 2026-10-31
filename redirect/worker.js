// Sends every request for the apex domain to the same path on www.
export default {
  fetch(request) {
    const url = new URL(request.url);
    return Response.redirect(
      `https://www.tylerevans.co${url.pathname}${url.search}`,
      301
    );
  },
};
