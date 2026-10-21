/**
 * The assistant's short description of the platform.
 *
 * This used to be a Romanian paragraph copied from a tutorial, which the
 * assistant could quote verbatim to a user who had no way to read it. It is
 * now written in English, in the product's own voice, and describes what the
 * platform actually does.
 *
 * The authoritative system prompt lives on the SERVER
 * (`BuildSync-API/services/ai/prompts.js`). This copy exists only so the
 * assistant can introduce itself in the chat panel before it has retrieved
 * any records.
 */

export const assistantIntro = `I'm Benny, the Builtra assistant.

Builtra is a construction operations platform: workforce and site records, daily attendance, leave, payroll, and client work requests - all connected, so nothing has to be tracked in a separate spreadsheet.

Ask me things like:
  - which work requests are overdue or blocked
  - what is starting in the next two weeks
  - who is present on site today
  - which leave requests are waiting for approval
  - what the payroll commitment looks like right now

I only ever show you records you are allowed to see, and I explain figures that the server has already calculated - I never guess at them.`;
