/** @type {import('next').NextConfig} */
const nextConfig = {
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "**.files-simplefileupload.com",
			},
		],
	},
};

export default nextConfig;
