import Script from "next/script";

// Solo se monta si NEXT_PUBLIC_GA_MEASUREMENT_ID existe — sin la variable,
// no carga ningún script (dev/preview sin configurar no manda datos de
// prueba a una cuenta real). Server Component: la variable ya está resuelta
// en build/request time, no hace falta "use client" para interpolarla acá.
export function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!gaId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}');`}
      </Script>
    </>
  );
}
