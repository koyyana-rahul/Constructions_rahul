export default async function run(page) {
  const out = { steps: [], errors: [] };
  const errs = [];
  page.on("pageerror", (e) => errs.push("PE: " + e.message.slice(0, 120)));
  page.on("console", (m) => {
    if (m.type() === "error") errs.push("E: " + m.text().slice(0, 100));
    if (m.type() === "warning") errs.push("W: " + m.text().slice(0, 100));
  });

  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto("http://localhost:4173/login", { waitUntil: "networkidle" });
  await page.fill("#email", "admin@uitest.test");
  await page.fill("#password", "Qa!Pass123");
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/dashboard/, { timeout: 20000 });

  // Grab two real employee ids from the API.
  // The session token lives in an httpOnly cookie, so the browser attaches it
  // automatically - the script must ask for credentials to be included and
  // must NOT try to read the token (it cannot).
  const ids = await page.evaluate(async () => {
    const csrf = document.cookie
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("builtra_csrf="))
      ?.split("=")[1];
    const r = await fetch("http://localhost:5050/api/employee?limit=100", {
      credentials: "include",
      headers: csrf ? { "X-CSRF-Token": decodeURIComponent(csrf) } : {},
    });
    const j = await r.json();
    return (j.employees || []).slice(0, 2).map((e) => ({
      id: e._id,
      name: e.userId?.name,
      code: e.employeeId,
    }));
  });
  out.employees = ids;

  const readHeader = () =>
    page.evaluate(() => {
      const h = document.querySelector("h2");
      const code = Array.from(document.querySelectorAll("p")).find((p) =>
        /^UI-\d+/i.test(p.textContent.trim()),
      );
      const tabs = Array.from(
        document.querySelectorAll('nav[aria-label="Employee sections"] a'),
      )
        .map((a) => a.textContent.trim())
        .filter(Boolean);
      const activeTab = document.querySelector(
        'nav[aria-label="Employee sections"] [aria-current="page"]',
      );
      const crumb = Array.from(
        document.querySelectorAll("nav[aria-label='Breadcrumb'] li"),
      )
        .map((l) => l.innerText.trim())
        .filter(Boolean);
      return {
        name: h ? h.innerText.trim() : null,
        code: code ? code.innerText.trim() : null,
        tabs,
        activeTab: activeTab ? activeTab.innerText.trim() : null,
        crumb,
      };
    });

  for (const emp of ids) {
    for (const [section, path] of [
      ["profile", `/admin-dashboard/employees/${emp.id}`],
      ["leave", `/admin-dashboard/employees/leaves/${emp.id}`],
      ["salary", `/admin-dashboard/employees/salary/${emp.id}`],
      ["attendance", `/admin-dashboard/employees/attendance/${emp.id}`],
    ]) {
      await page.goto("http://localhost:4173" + path, {
        waitUntil: "networkidle",
      });
      await page.waitForTimeout(1500);
      const header = await readHeader();
      out.steps.push({
        expect: emp.name,
        section,
        headerName: header.name,
        headerCode: header.code,
        matchesEmployee: header.name === emp.name && header.code === emp.code,
        activeTab: header.activeTab,
        crumb: header.crumb,
      });
    }
  }

  // Tab navigation from the profile page must keep the same employee.
  await page.goto(
    "http://localhost:4173/admin-dashboard/employees/" + ids[0].id,
    {
      waitUntil: "networkidle",
    },
  );
  await page.waitForTimeout(1500);
  await page.click('nav[aria-label="Employee sections"] a:has-text("Salary")');
  await page.waitForTimeout(1600);
  out.tabNavUrl = page.url();
  out.tabNavHeader = (await readHeader()).name;

  // Switching employees must swap the header, not blend the two.
  await page.goto(
    "http://localhost:4173/admin-dashboard/employees/" + ids[1].id,
    {
      waitUntil: "networkidle",
    },
  );
  await page.waitForTimeout(1600);
  out.switchedTo = (await readHeader()).name;
  out.switchedIsEmployeeB = (await readHeader()).name === ids[1].name;

  // Invalid id must degrade gracefully, never crash.
  await page.goto(
    "http://localhost:4173/admin-dashboard/employees/000000000000000000000000",
    {
      waitUntil: "networkidle",
    },
  );
  await page.waitForTimeout(1500);
  out.invalidIdText = await page
    .locator('[role="alert"], [role="status"]')
    .first()
    .innerText()
    .catch(() => null);
  out.crashedOnInvalid = errs.some((e) => /Cannot read|undefined/i.test(e));

  out.errors = errs;
  return out;
}
