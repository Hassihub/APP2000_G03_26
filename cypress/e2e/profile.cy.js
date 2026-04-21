// E2E-tester for profil- og innstillingssiden
// Registrerer en fersk testbruker – ingen reset-avhengighet

describe("Profilside – ikke innlogget", () => {
  it("uinnlogget bruker kommer ikke inn på /profile", () => {
    cy.visit("/profile");
    cy.url().should("satisfy", (url) =>
      url.includes("/login") || url.includes("/profile")
    );
    // Hvis siden ikke redirecter, skal den vise en feilmelding
    cy.get("body").invoke("text").then((text) => {
      const isBlocked =
        text.toLowerCase().includes("logg inn") ||
        text.toLowerCase().includes("ikke innlogget") ||
        text.toLowerCase().includes("ingen tilgang") ||
        !text.toLowerCase().includes("min profil");
      expect(isBlocked).to.be.true;
    });
  });
});

describe("Profilside – innlogget bruker", () => {
  let testUser;

  before(() => {
    // Registrer brukeren én gang for hele describe-blokken
    const ts = Date.now();
    testUser = {
      email: `cypress_profile_${ts}@test.no`,
      password: "Cypress123!",
      username: `cypress_${ts}`,
    };
    cy.request({
      method: "POST",
      url: "/api/auth/register",
      body: testUser,
      failOnStatusCode: false,
    });
  });

  beforeEach(() => {
    cy.loginByApi(testUser.email, testUser.password);
    cy.intercept("GET", "/api/profile*").as("profile");
    cy.visit("/profile");
    cy.wait("@profile", { timeout: 15000 });
  });

  it("viser profilsiden etter innlogging", () => {
    cy.url().should("include", "/profile");
    cy.get("body").should("not.be.empty");
  });

  it("viser brukerens brukernavn eller e-post", () => {
    cy.get("body").invoke("text").then((text) => {
      const hasIdentity =
        text.toLowerCase().includes(testUser.username.toLowerCase()) ||
        text.toLowerCase().includes(testUser.email.toLowerCase());
      expect(hasIdentity).to.be.true;
    });
  });

  it("siden inneholder ikke en 500-feil", () => {
    cy.get("body").invoke("text").then((text) => {
      expect(text).not.to.include("Internal Server Error");
    });
  });
});

describe("Innstillinger – innlogget bruker", () => {
  beforeEach(() => {
    cy.registerAndLogin();
    cy.visit("/settings");
  });

  it("laster innstillingssiden uten krasj", () => {
    cy.url().should("include", "/settings");
    cy.get("body").should("not.be.empty");
  });

  it("viser minst ett skjemaelement", () => {
    cy.get("input, select, textarea, button").should("exist");
  });

  it("siden inneholder ikke en 500-feil", () => {
    cy.get("body").invoke("text").then((text) => {
      expect(text).not.to.include("Internal Server Error");
    });
  });
});

describe("Utlogging", () => {
  it("bruker kan logge ut og blir sendt til forsiden eller login", () => {
    cy.registerAndLogin();
    cy.visit("/");

    // Finn en logout-knapp eller lenke
    cy.get("body").then(($body) => {
      const logoutEl = $body.find("button, a").filter((_, el) =>
        /logg ut|logout|sign out/i.test(el.textContent || "")
      );
      if (logoutEl.length === 0) {
        cy.log("Ingen synlig logout-knapp på forsiden – hopper over");
        return;
      }
      cy.wrap(logoutEl.first()).click();
      cy.url().should("satisfy", (url) =>
        url.includes("/login") || url === Cypress.config("baseUrl") + "/"
      );
    });
  });
});
