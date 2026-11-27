import { MapPin } from "lucide-react";
import { formatDateTime } from "../../lib/platformApi";
import { useLastPosition } from "./useLastPosition";

/** Ultima posicao conhecida do caminhao, com link para abrir no mapa. */
export function PositionInfo({ freightId }: { freightId: string }) {
  const { position, error } = useLastPosition(freightId, true);

  if (error) return <p className="text-sm text-red-600">Não foi possível consultar a posição agora.</p>;
  if (!position) {
    return (
      <p className="text-sm text-gray-500 flex items-center gap-1.5">
        <MapPin className="w-4 h-4" /> Sem posição recente do caminhão (o app do motorista envia durante a viagem).
      </p>
    );
  }
  const mapUrl = `https://www.openstreetmap.org/?mlat=${position.lat}&mlon=${position.lng}#map=13/${position.lat}/${position.lng}`;
  return (
    <p className="text-sm text-gray-700 flex flex-wrap items-center gap-1.5">
      <MapPin className="w-4 h-4 text-orange-600" />
      Posição em {formatDateTime(position.updated_at)}: {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
      <a href={mapUrl} target="_blank" rel="noreferrer" className="font-bold text-orange-600 hover:text-orange-700">
        Abrir no mapa
      </a>
    </p>
  );
}
