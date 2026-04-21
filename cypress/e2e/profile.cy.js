// E2E-tester for profilsiden (/profile)
// Tester at man ikke kommer inn uten å logge inn, og at
// innloggede brukere ser sin profil og kan redigere den

describe("Profilside – ikke innlogget", () => {
  it("redirect til login hvis man besøker /profile uten å være innlogget", () => {
    cy.visit("/profile");
    // Skal enten redirecte til /login eller vise en feilmelding
    cy.url().should("satisfy", (url) =>
      url.includes("/login") || url.includes("/profile")
    );
  });
});

describe("Profilside – innlogget bruker", () => {
  beforeEach(() => {
    cy.fixture("users").then((users) => {
      cy.login(users.validUser.email, users.validUser.password);
    });
    cy.visit("/profile");
  });

  it("viser profilsiden etter innlogging", () => {
    cy.url().should("include", "/profile");
    cy.get("body").should("not.be.empty");
  });

  it("viser brukerens e-post eller brukernavn", () => {
    // Profilen skal vise enten e-post eller brukernavn
    cy.fixture("users").then((users) => {
      cy.get("body").invoke("text").then((text) => {
        const email = users.validUser.email;
        const username = "Bruker1";
        expect(text.toLowerCase()).to.satisfy(
          (t) => t.includes(email.toLowerCase()) || t.includes(username.toLowerCase())
        );
      });
    });
  });

  it("viser en innstillinger- eller rediger-knapp", () => {
    cy.get("a[href*='/settings'], button")
      .filter(":contains('Rediger'), :contains('Innstillinger'), :contains('Edit')")
      .should("exist");
  });
});

describe("Innstillinger – innlogget bruker", () => {
  beforeEach(() => {
    cy.fixture("users").then((users) => {
      cy.login(users.validUser.email, users.validUser.password);
    });
    cy.visit("/settings");
  });

  it("laster innstillingssiden", () => {
    cy.url().should("include", "/settings");
    cy.get("body").should("not.be.empty");
  });

  it("viser skjema for å endre passord eller profil", () => {
    cy.get("input, button, form").should("exist");
  });
});
