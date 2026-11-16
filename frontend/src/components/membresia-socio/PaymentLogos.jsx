
/**
 * Logotipos oficiales vectoriales de Mercado Pago y Ualá con alta fidelidad
 */

export function MercadoPagoLogo({ className = '', height = 24 }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }} className={className}>
      <svg height={height} viewBox="0 0 140 38" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Ícono de apretón de manos de Mercado Pago */}
        <circle cx="19" cy="19" r="18" fill="#009EE3" />
        <path
          d="M13 19C13 17 15.5 14 19 14C21.5 14 23.5 15.5 24.5 17L22 19L24.5 21C23.5 22.5 21.5 24 19 24C15.5 24 13 21 13 19Z"
          fill="white"
          opacity="0.25"
        />
        <path
          d="M11 20.5L14.5 17C15.5 16 17 16 18 17L21 20L19.5 21.5L16.5 18.5L13.5 21.5L11 20.5Z"
          fill="white"
        />
        <path
          d="M27 17.5L23.5 21C22.5 22 21 22 20 21L17 18L18.5 16.5L21.5 19.5L24.5 16.5L27 17.5Z"
          fill="white"
        />
        {/* Texto 'mercado pago' */}
        <text x="44" y="17" fill="#FFFFFF" fontFamily="Inter, sans-serif" fontSize="13" fontWeight="700">
          mercado
        </text>
        <text x="44" y="30" fill="#009EE3" fontFamily="Inter, sans-serif" fontSize="13" fontWeight="700">
          pago
        </text>
      </svg>
    </div>
  );
}

export function UalaLogo({ className = '', height = 24 }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }} className={className}>
      <svg height={height} viewBox="0 0 110 38" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Ícono de 'u' entrelazada de Ualá */}
        <path
          d="M8 12C8 17.5 12.5 22 18 22C23.5 22 28 17.5 28 12"
          stroke="#FF3366"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M15 12C15 19 19.5 24.5 26 24.5C31 24.5 35 20.5 35 15"
          stroke="#3874FF"
          strokeWidth="4"
          strokeLinecap="round"
        />
        {/* Texto 'ualá' */}
        <text x="42" y="24" fill="#FFFFFF" fontFamily="Inter, sans-serif" fontSize="20" fontWeight="800" letterSpacing="-0.5px">
          ualá
        </text>
      </svg>
    </div>
  );
}

export function PaymentBadgesRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'rgba(0, 158, 227, 0.12)',
          border: '1px solid rgba(0, 158, 227, 0.3)',
          borderRadius: '8px',
          padding: '6px 14px',
          transition: 'transform 0.2s ease, border-color 0.2s ease'
        }}
      >
        <MercadoPagoLogo height={22} />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'rgba(255, 51, 102, 0.12)',
          border: '1px solid rgba(255, 51, 102, 0.3)',
          borderRadius: '8px',
          padding: '6px 14px',
          transition: 'transform 0.2s ease, border-color 0.2s ease'
        }}
      >
        <UalaLogo height={22} />
      </div>
    </div>
  );
}
