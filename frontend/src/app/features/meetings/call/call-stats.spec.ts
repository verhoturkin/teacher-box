import { aParticipant } from '@testing/meetings-fixtures';
import { CallStats } from './call-engine';
import { readStats, statsSections } from './call-stats';

function report(...entries: unknown[]): Map<string, unknown> {
  return new Map(entries.map((entry, index) => [String(index), entry]));
}

const EMPTY: CallStats = {
  serverVersion: null,
  transport: null,
  audioIn: null,
  audioOutLoss: null,
  videoOut: null,
  videoOutLimit: null,
  videoIn: null,
};

describe('readStats', () => {
  it('reads the selected pair, sound and video of several reports', () => {
    const connection = report(
      { id: 'T1', type: 'transport', selectedCandidatePairId: 'P1' },
      {
        id: 'P1',
        type: 'candidate-pair',
        localCandidateId: 'L1',
        remoteCandidateId: 'R1',
        currentRoundTripTime: 0.0423,
        availableOutgoingBitrate: 1_500_400,
      },
      { id: 'L1', type: 'local-candidate', protocol: 'udp', candidateType: 'srflx', port: 50_123 },
      { id: 'R1', type: 'remote-candidate', protocol: 'udp', address: '203.0.113.5', port: 7882 },
      {
        id: 'IA1',
        type: 'inbound-rtp',
        kind: 'audio',
        packetsReceived: 980,
        packetsLost: 20,
        jitter: 0.012,
        concealedSamples: 4800,
        totalSamplesReceived: 96_000,
      },
      { id: 'RA', type: 'remote-inbound-rtp', kind: 'audio', fractionLost: 0.0125 },
      {
        id: 'OV-low',
        type: 'outbound-rtp',
        kind: 'video',
        frameWidth: 320,
        frameHeight: 180,
        qualityLimitationReason: 'none',
      },
      {
        id: 'OV-high',
        type: 'outbound-rtp',
        kind: 'video',
        frameWidth: 1280,
        frameHeight: 720,
        framesPerSecond: 29.6,
        qualityLimitationReason: 'bandwidth',
      },
      { id: 'IV', type: 'inbound-rtp', kind: 'video', frameWidth: 640, frameHeight: 360 },
    );
    const second = report(
      { id: 'IA2', type: 'inbound-rtp', kind: 'audio', packetsReceived: 20, jitter: 0.03 },
      { id: 'skip', value: 1 },
      'not a dictionary',
    );

    expect(readStats([connection, second], '1.13.7')).toEqual({
      serverVersion: '1.13.7',
      transport: {
        protocol: 'udp',
        candidate: 'srflx',
        relayProtocol: null,
        localPort: 50_123,
        remoteAddress: '203.0.113.5',
        remotePort: 7882,
        roundTrip: 42,
        outgoingBitrate: 1500,
      },
      audioIn: { packetsReceived: 1000, packetsLost: 20, jitter: 30, concealed: 5 },
      audioOutLoss: 1.3,
      videoOut: { width: 1280, height: 720, frameRate: 30 },
      videoOutLimit: 'bandwidth',
      videoIn: { width: 640, height: 360, frameRate: null },
    });
  });

  it('falls back to the succeeded nominated pair and tolerates gaps', () => {
    const stats = readStats(
      [
        report(
          { id: 'P', type: 'candidate-pair', state: 'succeeded', nominated: true },
          { id: 'IA', type: 'inbound-rtp', kind: 'audio' },
        ),
      ],
      null,
    );

    expect(stats.transport).toEqual({
      protocol: null,
      candidate: null,
      relayProtocol: null,
      localPort: null,
      remoteAddress: null,
      remotePort: null,
      roundTrip: null,
      outgoingBitrate: null,
    });
    expect(stats.audioIn).toEqual({
      packetsReceived: 0,
      packetsLost: 0,
      jitter: null,
      concealed: null,
    });
    expect(readStats([], null)).toEqual(EMPTY);
  });
});

describe('statsSections', () => {
  const people = [
    aParticipant({ name: 'Учитель', quality: 'excellent' }),
    aParticipant({ id: 'a', name: 'Анна', local: false, quality: 'poor' }),
  ];

  it('shows only the quality of everyone without details', () => {
    expect(statsSections(null, people)).toEqual([
      {
        title: 'Качество связи',
        rows: [
          { label: 'Учитель (вы)', value: 'отличная' },
          { label: 'Анна', value: 'слабая' },
        ],
      },
    ]);
    expect(statsSections(EMPTY, people)).toHaveLength(1);
  });

  it('describes the connection, sound, video and server', () => {
    const sections = statsSections(
      {
        serverVersion: '1.13.7',
        transport: {
          protocol: 'tcp',
          candidate: 'relay',
          relayProtocol: 'udp',
          localPort: 50_000,
          remoteAddress: '203.0.113.5',
          remotePort: 7881,
          roundTrip: 120,
          outgoingBitrate: 800,
        },
        audioIn: { packetsReceived: 990, packetsLost: 10, jitter: 25, concealed: 2.5 },
        audioOutLoss: 0.4,
        videoOut: { width: 1280, height: 720, frameRate: 24 },
        videoOutLimit: 'cpu',
        videoIn: { width: 640, height: 360, frameRate: null },
      },
      [aParticipant({ quality: 'unknown' })],
    );

    expect(sections.map((section) => section.title)).toEqual([
      'Качество связи',
      'Соединение',
      'Звук',
      'Видео',
      'Сервер звонков',
    ]);
    const values = Object.fromEntries(
      sections.flatMap((section) => section.rows).map((row) => [row.label, row.value]),
    );
    expect(values).toMatchObject({
      Протокол: 'TCP',
      Путь: 'через ретранслятор TURN (UDP)',
      Сервер: '203.0.113.5:7881',
      'Порт браузера': '50000',
      'Задержка (туда и обратно)': '120 мс',
      'Скорость отправки (оценка)': '800 кбит/с',
      'Входящий: потери пакетов': '10 из 1000',
      'Входящий: джиттер': '25 мс',
      'Входящий: восстановлено браузером': '2.5 %',
      'Исходящий: потери на сервере': '0.4 %',
      Отправляется: '1280×720, 24 кадр/с',
      'Ограничение отправки': 'процессор',
      Принимается: '640×360',
      LiveKit: '1.13.7',
    });
  });

  it('keeps unknown values as they are and leaves out the missing ones', () => {
    const sections = statsSections(
      {
        ...EMPTY,
        transport: {
          protocol: 'udp',
          candidate: 'mystery',
          relayProtocol: null,
          localPort: null,
          remoteAddress: '198.51.100.1',
          remotePort: null,
          roundTrip: null,
          outgoingBitrate: null,
        },
        audioIn: { packetsReceived: 5, packetsLost: 0, jitter: null, concealed: null },
        videoOutLimit: 'thermal',
      },
      [],
    );

    expect(sections[1]?.rows).toEqual([
      { label: 'Протокол', value: 'UDP' },
      { label: 'Путь', value: 'mystery' },
      { label: 'Сервер', value: '198.51.100.1' },
    ]);
    expect(sections[2]?.rows).toEqual([{ label: 'Входящий: потери пакетов', value: '0 из 5' }]);
    expect(sections[3]?.rows).toEqual([{ label: 'Ограничение отправки', value: 'thermal' }]);
  });
});
