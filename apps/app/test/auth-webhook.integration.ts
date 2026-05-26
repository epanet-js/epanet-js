const userCreatedEvent = {
  type: "user.created",
  data: {
    email_addresses: [{ email_address: "foo@example.org" }],
    first_name: "Petter",
    last_name: "Wilson",
  },
};

const url = `http://localhost:3000/api/auth-webhook?token=${process.env.CLERK_WEBHOOK_TOKEN}`;

fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(userCreatedEvent),
})
  .then(async (response) => {
    // eslint-disable-next-line
    console.log("STATUS", response.status);
    // eslint-disable-next-line
    console.log("BODY", await response.text());
  })
  // eslint-disable-next-line
  .catch((error) => console.error(`ERROR: ${error}`));
