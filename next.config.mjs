/** @type {import('next').NextConfig} */
const nextConfig = {
<<<<<<< HEAD
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "connect-src 'self' https://api.met.no https://nominatim.openstreetmap.org",
            ].join("; "),
          },
        ],
      },
    ];
  },
=======
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "**.files-simplefileupload.com",
			},
		],
	},
>>>>>>> main2.69
};

export default nextConfig;
