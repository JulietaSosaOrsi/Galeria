/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Permite que next/image optimice las fotos que vienen de Supabase Storage.
    // Reemplaza "TU-PROYECTO" por el ID real de tu proyecto de Supabase
    // (lo obtienes de la URL: https://TU-PROYECTO.supabase.co)
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

module.exports = nextConfig;
