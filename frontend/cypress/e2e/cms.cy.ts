describe("SBCMS Admin Portal", () => {
  beforeEach(() => {
    // Intercept settings configuration fetches
    cy.intercept("GET", "/api/settings", {
      id: "settings-default",
      siteTitle: "My SBCMS Test Site",
      isBlogEnabled: true,
      isStoreEnabled: true,
    }).as("getSettings");

    // Intercept analytics overview metrics
    cy.intercept("GET", "/api/analytics/dashboard", {
      stats: { pageviews: 120, sessions: 45, purchases: 3, revenue: 87.5 },
      splits: { devices: { desktop: 80, mobile: 40 }, browsers: { chrome: 90, safari: 30 }, countries: { USA: 120 } },
      funnel: { pageviews: 120, checkoutStarts: 20, purchasesCompleted: 3 }
    }).as("getDashboard");

    cy.visit("/");
  });

  it("should render the admin dashboard metrics successfully", () => {
    cy.wait(["@getSettings", "@getDashboard"]);
    cy.contains("Dashboard Overview").should("be.visible");
    cy.contains("Pageviews").should("be.visible");
    cy.contains("120").should("be.visible");
    cy.contains("$87.50").should("be.visible");
  });

  it("should navigate to static Pages list view and view items", () => {
    cy.intercept("GET", "/api/pages", [
      { id: "page-1", title: "Home Page", slug: "home", isPublished: true, updatedAt: new Date().toISOString() }
    ]).as("getPages");

    cy.contains("Pages").click();
    cy.wait("@getPages");

    cy.url().should("include", "/pages");
    cy.contains("Site Pages").should("be.visible");
    cy.contains("Home Page").should("be.visible");
    cy.contains("/home").should("be.visible");
  });
});
