import {
  CallAudioIn,
  CallParticipant,
  CallQuality,
  CallStats,
  CallTransport,
  CallVideo,
} from './call-engine';

/** An `RTCStatsReport` (or a `Map` in tests): every entry is a dictionary with `id` and `type`. */
export interface StatsReport {
  forEach(callback: (value: unknown) => void): void;
}

type Entry = Readonly<Record<string, unknown>>;

/**
 * The technical details of a call from the WebRTC statistics of its tracks (one peer connection or two,
 * the same entries may come from several reports).
 */
export function readStats(
  reports: readonly StatsReport[],
  serverVersion: string | null,
): CallStats {
  const entries = new Map<string, Entry>();
  for (const report of reports) {
    report.forEach((value) => {
      if (isEntry(value)) {
        entries.set(text(value, 'id') ?? String(entries.size), value);
      }
    });
  }
  const all = [...entries.values()];
  const rtp = (type: string, kind: string): Entry[] =>
    all.filter((entry) => entry['type'] === type && entry['kind'] === kind);
  const sent = largestEntry(rtp('outbound-rtp', 'video'));
  return {
    serverVersion,
    transport: transport(entries, all),
    audioIn: audioIn(rtp('inbound-rtp', 'audio')),
    audioOutLoss: percentOf(rtp('remote-inbound-rtp', 'audio'), 'fractionLost'),
    videoOut: video(sent),
    videoOutLimit: sent === undefined ? null : text(sent, 'qualityLimitationReason'),
    videoIn: video(largestEntry(rtp('inbound-rtp', 'video'))),
  };
}

function transport(
  entries: ReadonlyMap<string, Entry>,
  all: readonly Entry[],
): CallTransport | null {
  const selectedIds = all
    .filter((entry) => entry['type'] === 'transport')
    .map((entry) => text(entry, 'selectedCandidatePairId'))
    .filter((id): id is string => id !== null);
  const pair =
    selectedIds.map((id) => entries.get(id)).find((entry) => entry !== undefined) ??
    all.find(
      (entry) =>
        entry['type'] === 'candidate-pair' &&
        entry['state'] === 'succeeded' &&
        (entry['selected'] === true || entry['nominated'] === true),
    );
  if (pair === undefined) {
    return null;
  }
  const local = entries.get(text(pair, 'localCandidateId') ?? '');
  const remote = entries.get(text(pair, 'remoteCandidateId') ?? '');
  const roundTrip = number(pair, 'currentRoundTripTime');
  const bitrate = number(pair, 'availableOutgoingBitrate');
  return {
    protocol: field(local, (found) => text(found, 'protocol')),
    candidate: field(local, (found) => text(found, 'candidateType')),
    relayProtocol: field(local, (found) => text(found, 'relayProtocol')),
    localPort: field(local, (found) => number(found, 'port')),
    remoteAddress: field(remote, (found) => text(found, 'address') ?? text(found, 'ip')),
    remotePort: field(remote, (found) => number(found, 'port')),
    roundTrip: roundTrip === null ? null : Math.round(roundTrip * 1000),
    outgoingBitrate: bitrate === null ? null : Math.round(bitrate / 1000),
  };
}

function audioIn(streams: readonly Entry[]): CallAudioIn | null {
  if (streams.length === 0) {
    return null;
  }
  const sum = (key: string): number =>
    streams.reduce((total, entry) => total + (number(entry, key) ?? 0), 0);
  const jitters = streams.map((entry) => number(entry, 'jitter')).filter((value) => value !== null);
  const samples = sum('totalSamplesReceived');
  return {
    packetsReceived: sum('packetsReceived'),
    packetsLost: Math.max(0, sum('packetsLost')),
    jitter: jitters.length === 0 ? null : Math.round(Math.max(...jitters) * 1000),
    concealed: samples > 0 ? round(sum('concealedSamples') / samples) : null,
  };
}

function percentOf(streams: readonly Entry[], key: string): number | null {
  const values = streams.map((entry) => number(entry, key)).filter((value) => value !== null);
  return values.length === 0 ? null : round(Math.max(...values));
}

function largestEntry(streams: readonly Entry[]): Entry | undefined {
  const area = (entry: Entry): number =>
    (number(entry, 'frameWidth') ?? 0) * (number(entry, 'frameHeight') ?? 0);
  return [...streams].filter((entry) => area(entry) > 0).sort((a, b) => area(b) - area(a))[0];
}

function video(entry: Entry | undefined): CallVideo | null {
  if (entry === undefined) {
    return null;
  }
  const rate = number(entry, 'framesPerSecond');
  return {
    width: number(entry, 'frameWidth') ?? 0,
    height: number(entry, 'frameHeight') ?? 0,
    frameRate: rate === null ? null : Math.round(rate),
  };
}

/** A value of a candidate that may be missing. */
function field<T>(entry: Entry | undefined, read: (found: Entry) => T | null): T | null {
  return entry === undefined ? null : read(entry);
}

/** A share (0…1) as a percent with one decimal. */
function round(share: number): number {
  return Math.round(share * 1000) / 10;
}

function isEntry(value: unknown): value is Entry {
  return typeof value === 'object' && value !== null && 'type' in value;
}

function text(entry: Entry, key: string): string | null {
  const value = entry[key];
  return typeof value === 'string' && value !== '' ? value : null;
}

function number(entry: Entry, key: string): number | null {
  const value = entry[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** A titled group of «label — value» lines of the dialog. */
export interface StatsSection {
  readonly title: string;
  readonly rows: readonly { readonly label: string; readonly value: string }[];
}

const QUALITY_TEXTS: Readonly<Record<CallQuality, string>> = {
  excellent: 'отличная',
  good: 'хорошая',
  poor: 'слабая',
  lost: 'потеряна',
  unknown: 'неизвестна',
};

const CANDIDATE_TEXTS: Readonly<Record<string, string>> = {
  host: 'прямое',
  srflx: 'через NAT',
  prflx: 'через NAT',
  relay: 'через ретранслятор TURN',
};

const LIMIT_TEXTS: Readonly<Record<string, string>> = {
  none: 'нет',
  bandwidth: 'скорость канала',
  cpu: 'процессор',
  other: 'другое',
};

/** What «Сведения о связи» shows: people, the connection, sound and video. */
export function statsSections(
  stats: CallStats | null,
  participants: readonly CallParticipant[],
): StatsSection[] {
  const sections: StatsSection[] = [
    {
      title: 'Качество связи',
      rows: participants.map((person) => ({
        label: person.local ? `${person.name} (вы)` : person.name,
        value: QUALITY_TEXTS[person.quality],
      })),
    },
  ];
  if (stats === null) {
    return sections;
  }
  const line = (label: string, value: string | null): { label: string; value: string }[] =>
    value === null ? [] : [{ label, value }];
  const transport = stats.transport;
  if (transport !== null) {
    const protocol = transport.protocol?.toUpperCase() ?? null;
    sections.push({
      title: 'Соединение',
      rows: [
        ...line('Протокол', protocol),
        ...line(
          'Путь',
          transport.candidate === null
            ? null
            : (CANDIDATE_TEXTS[transport.candidate] ?? transport.candidate) +
                (transport.relayProtocol === null
                  ? ''
                  : ` (${transport.relayProtocol.toUpperCase()})`),
        ),
        ...line(
          'Сервер',
          transport.remoteAddress === null
            ? null
            : `${transport.remoteAddress}${transport.remotePort === null ? '' : `:${String(transport.remotePort)}`}`,
        ),
        ...line('Порт браузера', transport.localPort === null ? null : String(transport.localPort)),
        ...line(
          'Задержка (туда и обратно)',
          transport.roundTrip === null ? null : `${String(transport.roundTrip)} мс`,
        ),
        ...line(
          'Скорость отправки (оценка)',
          transport.outgoingBitrate === null ? null : `${String(transport.outgoingBitrate)} кбит/с`,
        ),
      ],
    });
  }
  const audio = stats.audioIn;
  const sound = [
    ...(audio === null
      ? []
      : [
          ...line(
            'Входящий: потери пакетов',
            `${String(audio.packetsLost)} из ${String(audio.packetsLost + audio.packetsReceived)}`,
          ),
          ...line('Входящий: джиттер', audio.jitter === null ? null : `${String(audio.jitter)} мс`),
          ...line(
            'Входящий: восстановлено браузером',
            audio.concealed === null ? null : `${String(audio.concealed)} %`,
          ),
        ]),
    ...line(
      'Исходящий: потери на сервере',
      stats.audioOutLoss === null ? null : `${String(stats.audioOutLoss)} %`,
    ),
  ];
  if (sound.length > 0) {
    sections.push({ title: 'Звук', rows: sound });
  }
  const pictures = [
    ...line('Отправляется', videoText(stats.videoOut)),
    ...line(
      'Ограничение отправки',
      stats.videoOutLimit === null
        ? null
        : (LIMIT_TEXTS[stats.videoOutLimit] ?? stats.videoOutLimit),
    ),
    ...line('Принимается', videoText(stats.videoIn)),
  ];
  if (pictures.length > 0) {
    sections.push({ title: 'Видео', rows: pictures });
  }
  if (stats.serverVersion !== null) {
    sections.push({
      title: 'Сервер звонков',
      rows: [{ label: 'LiveKit', value: stats.serverVersion }],
    });
  }
  return sections;
}

function videoText(video: CallVideo | null): string | null {
  if (video === null) {
    return null;
  }
  const size = `${String(video.width)}×${String(video.height)}`;
  return video.frameRate === null ? size : `${size}, ${String(video.frameRate)} кадр/с`;
}
