/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: "/wardrobe",   destination: "/closet",   permanent: true },
      { source: "/coordinate", destination: "/style",    permanent: true },
      { source: "/inspire",    destination: "/discover", permanent: true },
      { source: "/profile",    destination: "/self",     permanent: true },
      { source: "/worldview",  destination: "/self",     permanent: true },
    ];
  },
};

export default nextConfig;
