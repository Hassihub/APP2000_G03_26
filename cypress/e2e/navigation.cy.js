// Tester at alle hovedsider svarer og laster riktig
describe("Navigasjon", () => {
  const pages = [
    { path: "/",        label: "Hjem"    },
    { path: "/explore", label: "Utforsk" },
    { path: "/map",     label: "Kart"    },
    { path: "/vaer",    label: "Vær"      },
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
