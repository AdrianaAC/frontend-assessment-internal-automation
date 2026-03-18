import { expect, test } from "@playwright/test";

test.describe("workflow browser flows", () => {
  test("validates required fields before the workflow runs", async ({ page }) => {
    await page.goto("/");

    const dealNameInput = page.getByLabel("Deal name");

    await dealNameInput.fill("");
    await page.getByRole("button", { name: "Run automation" }).click();

    await expect(
      page.getByText("Review the highlighted fields before running the workflow.")
    ).toBeVisible();
    await expect(dealNameInput).toBeFocused();
    await expect(dealNameInput).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Deal name is required.")).toBeVisible();
  });

  test("runs, pauses for approval, and resumes using the persisted workflow run id", async ({
    page,
  }) => {
    await page.goto("/");

    let resumeRequestBody: Record<string, unknown> | undefined;

    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        request.url().endsWith("/api/workflow/resume")
      ) {
        resumeRequestBody = request.postDataJSON() as Record<string, unknown>;
      }
    });

    await page.getByRole("button", { name: "Run automation" }).click();

    await expect(
      page.getByText("Workflow paused before provisioning.")
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Approve and continue" })
    ).toBeVisible();

    const workflowRunId = await page
      .locator("text=Workflow run ID")
      .locator("..")
      .locator("p.font-mono")
      .innerText();

    await page.getByLabel("Approved by").fill("Operations Lead");
    await page.getByLabel("Approval notes").fill("Reviewed in browser flow.");
    await page.getByRole("button", { name: "Approve and continue" }).click();

    await expect(page.locator("dd", { hasText: "Operations Lead" })).toBeVisible();
    await expect(
      page.locator("dd", { hasText: "Reviewed in browser flow." })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Approve and continue" })
    ).toHaveCount(0);

    await page.getByRole("tab", { name: "Systems" }).click();
    await expect(page.getByRole("heading", { name: "Email Notification" })).toBeVisible();

    expect(resumeRequestBody).toBeDefined();
    expect(resumeRequestBody).toMatchObject({
      workflowRunId: workflowRunId.trim(),
      approval: {
        approvedBy: "Operations Lead",
        notes: "Reviewed in browser flow.",
      },
    });
    expect(resumeRequestBody).not.toHaveProperty("deal");
    expect(resumeRequestBody).not.toHaveProperty("enrichment");
    expect(resumeRequestBody).not.toHaveProperty("enrichmentContext");
  });
});
