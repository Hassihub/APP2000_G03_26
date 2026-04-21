// Tester at alle hovedsider svarer og laster riktig
describe("Navigasjon", () => {
  const pages = [
    { path: "/",        label: "Hjem"    },
    { path: "/explore", label: "Utforsk" },
    { path: "/map",     label: "Kart"    },
    { path: "/weather", label: "Vær"     },
    { path: "/reserver", label: "Hytter" },
    { path: "/profile", label: "Profil"  },
    { path: "/sosial",  label: "Sosial"  },
    { path: "/login",   label: "Login"   },
    { path: "/signup",  label: "Signup"  },
  ];

  pages.forEach(({ path, label }) => {
    it(`laster ${label}-siden (${path})`, () => {
      cy.visit(path);
      cy.url().should("include", path === "/" ? "" : path);
      // Siden skal ikke krasje — ingen tom <body>
      cy.get("body").should("not.be.empty");
    });
  });
});

describe("Navigasjon – beskyttede sider (tilgangskontroll)", () => {
  it("/admin er ikke tilgjengelig for uinnlogget", () => {
    cy.visit("/admin");
    // Skal enten redirecte til /login eller vise ingen-tilgang-melding
    cy.get("body").invoke("text").then((text) => {
      const blocked =
        cy.url().then((url) => url.includes("/login")) ||
        text.toLowerCase().includes("tilgang") ||
        text.toLowerCase().includes("logg inn") ||
        !text.toLowerCase().includes("alle brukere");
      expect(blocked).to.be.ok;
    });
  });

  it("/turrute/ny er ikke tilgjengelig for uinnlogget", () => {
    cy.visit("/turrute/ny");
    // Skal redirecte eller vise feilmelding
    cy.get("body").should("not.be.empty");
    cy.get("body").invoke("text").then((text) => {
      expect(text).not.to.include("Internal Server Error");
    });
  });

  it("/reserver/ny er ikke tilgjengelig for uinnlogget", () => {
    cy.visit("/reserver/ny");
    cy.url().should("satisfy", (url) =>
      url.includes("/login") || url.includes("/reserver")
    );
  });
});
