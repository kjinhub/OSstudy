import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowLeft,
  ArrowRight,
  Cpu,
  FileDown,
  Flag,
  Gauge,
  GitBranch,
  KeyRound,
  LockKeyhole,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Timer,
} from 'lucide-react';
import './styles.css';

const codeDekker = `public void lock(int i) {
    int j = 1 - i;
    setFlag(i, true);

    while (getFlag(j)) {
        if (turn == j) {
            setFlag(i, false);
            while (turn == j) {
                Thread.onSpinWait();
            }
            setFlag(i, true);
        }
    }
}

public void unlock(int i) {
    int j = 1 - i;
    turn = j;
    setFlag(i, false);
}`;

const codePeterson = `setFlag(i, true);
turn = j;

while (getFlag(j) && turn == j) {
    Thread.onSpinWait();
}

// critical section

setFlag(i, false);`;

const version1Code = `static volatile int threadNumber = 1;

// Thread-1
while (threadNumber == 2) {
    Thread.onSpinWait();
}
sharedCount++;
threadNumber = 2;

// Thread-2
while (threadNumber == 1) {
    Thread.onSpinWait();
}
sharedCount++;
threadNumber = 1;`;

const version2Code = `static volatile boolean t1Inside = false;
static volatile boolean t2Inside = false;

// Thread-1
while (t2Inside) {
    Thread.onSpinWait();
}
t1Inside = true;
sharedCount++;
t1Inside = false;

// Thread-2도 반대로 수행`;

const version3Code = `static volatile boolean t1Inside = false;
static volatile boolean t2Inside = false;

// Thread-1
t1Inside = true;
while (t2Inside) {
    Thread.onSpinWait();
}
sharedCount++;
t1Inside = false;

// Thread-2도 반대로 수행`;

const version4Code = `static volatile boolean t1Inside = false;
static volatile boolean t2Inside = false;

// Thread-1
t1Inside = true;
while (t2Inside) {
    t1Inside = false;
    Thread.onSpinWait();
    t1Inside = true;
}
sharedCount++;
t1Inside = false;

// Thread-2도 반대로 수행`;

const dekkerTutorCode = `boolean[] flag = {false, false};
int turn = 0;
String criticalSection = null;

flag[0] = true;
flag[1] = true;

if (flag[1] && turn == 0) {
  criticalSection = "P0";
}

turn = 1;
flag[0] = false;
criticalSection = null;

if (flag[0] == false && turn == 1) {
  criticalSection = "P1";
}

System.out.println("P0 then P1");`;

const initialTutorStep = {
  line: 0,
  code: '',
  variables: {},
  memory: {},
  console: [],
  changed: [],
  explanation: '처음 상태입니다. 다음 단계 버튼을 누르면 데커 알고리즘의 공유 변수들이 한 줄씩 바뀌는 과정을 볼 수 있습니다.',
};

const executionSteps = [
  initialTutorStep,
  {
    line: 1,
    code: 'boolean[] flag = {false, false};',
    variables: { flag: '&A1' },
    memory: { A1: { type: 'array', name: 'flag', values: [false, false] } },
    console: [],
    changed: ['flag', 'A1'],
    explanation: '두 프로세스의 진입 의사를 저장할 flag 배열이 만들어졌습니다. 아직 P0와 P1 모두 임계 구역에 들어가고 싶지 않은 상태입니다.',
  },
  {
    line: 2,
    code: 'int turn = 0;',
    variables: { flag: '&A1', turn: 0 },
    memory: { A1: { type: 'array', name: 'flag', values: [false, false] } },
    console: [],
    changed: ['turn'],
    explanation: '충돌이 생겼을 때 P0에게 우선권이 있도록 turn 값이 0으로 초기화되었습니다.',
  },
  {
    line: 3,
    code: 'String criticalSection = null;',
    variables: { flag: '&A1', turn: 0, criticalSection: null },
    memory: { A1: { type: 'array', name: 'flag', values: [false, false] } },
    console: [],
    changed: ['criticalSection'],
    explanation: '현재 임계 구역에는 아무도 들어가 있지 않으므로 criticalSection 값은 null입니다.',
  },
  {
    line: 5,
    code: 'flag[0] = true;',
    variables: { flag: '&A1', turn: 0, criticalSection: null },
    memory: { A1: { type: 'array', name: 'flag', values: [true, false], changedIndexes: [0] } },
    console: [],
    changed: ['A1'],
    explanation: 'P0가 임계 구역에 들어가고 싶다는 의사를 flag[0]에 true로 표시합니다.',
  },
  {
    line: 6,
    code: 'flag[1] = true;',
    variables: { flag: '&A1', turn: 0, criticalSection: null },
    memory: { A1: { type: 'array', name: 'flag', values: [true, true], changedIndexes: [1] } },
    console: [],
    changed: ['A1'],
    explanation: 'P1도 임계 구역에 들어가고 싶다는 의사를 flag[1]에 true로 표시합니다. 이제 두 프로세스가 동시에 들어가려는 충돌 상태입니다.',
  },
  {
    line: 8,
    code: 'if (flag[1] && turn == 0) {',
    variables: { flag: '&A1', turn: 0, criticalSection: null },
    memory: { A1: { type: 'array', name: 'flag', values: [true, true] } },
    console: [],
    changed: [],
    explanation: 'P0 입장에서 상대방 flag[1]은 true이지만 turn이 0이므로 P0에게 우선권이 있습니다. 조건 결과가 true라서 if 블록으로 이동합니다.',
  },
  {
    line: 9,
    code: 'criticalSection = "P0";',
    variables: { flag: '&A1', turn: 0, criticalSection: 'P0' },
    memory: { A1: { type: 'array', name: 'flag', values: [true, true] } },
    console: [],
    changed: ['criticalSection'],
    explanation: '우선권을 가진 P0가 임계 구역에 들어갔습니다. 동시에 P1은 들어갈 수 없습니다.',
  },
  {
    line: 12,
    code: 'turn = 1;',
    variables: { flag: '&A1', turn: 1, criticalSection: 'P0' },
    memory: { A1: { type: 'array', name: 'flag', values: [true, true] } },
    console: [],
    changed: ['turn'],
    explanation: 'P0가 임계 구역을 빠져나오기 전에 다음 우선권을 P1에게 넘기기 위해 turn을 1로 바꿉니다.',
  },
  {
    line: 13,
    code: 'flag[0] = false;',
    variables: { flag: '&A1', turn: 1, criticalSection: 'P0' },
    memory: { A1: { type: 'array', name: 'flag', values: [false, true], changedIndexes: [0] } },
    console: [],
    changed: ['A1'],
    explanation: 'P0는 더 이상 임계 구역에 들어가고 싶지 않다는 뜻으로 flag[0]을 false로 내립니다.',
  },
  {
    line: 14,
    code: 'criticalSection = null;',
    variables: { flag: '&A1', turn: 1, criticalSection: null },
    memory: { A1: { type: 'array', name: 'flag', values: [false, true] } },
    console: [],
    changed: ['criticalSection'],
    explanation: 'P0가 임계 구역에서 나왔으므로 현재 임계 구역은 비어 있습니다.',
  },
  {
    line: 16,
    code: 'if (flag[0] == false && turn == 1) {',
    variables: { flag: '&A1', turn: 1, criticalSection: null },
    memory: { A1: { type: 'array', name: 'flag', values: [false, true] } },
    console: [],
    changed: [],
    explanation: 'P1 입장에서 P0의 flag가 false이고 turn도 1입니다. 조건 결과가 true라서 P1이 들어갈 수 있습니다.',
  },
  {
    line: 17,
    code: 'criticalSection = "P1";',
    variables: { flag: '&A1', turn: 1, criticalSection: 'P1' },
    memory: { A1: { type: 'array', name: 'flag', values: [false, true] } },
    console: [],
    changed: ['criticalSection'],
    explanation: '기다리던 P1이 임계 구역에 들어갑니다. 데커 알고리즘은 충돌 시에도 한 번에 하나만 들어가도록 순서를 정합니다.',
  },
  {
    line: 20,
    code: 'System.out.println("P0 then P1");',
    variables: { flag: '&A1', turn: 1, criticalSection: 'P1' },
    memory: { A1: { type: 'array', name: 'flag', values: [false, true] } },
    console: ['P0 then P1'],
    changed: ['console'],
    explanation: '실행 결과가 콘솔에 출력됩니다. 최종 흐름은 P0가 먼저 들어가고, 우선권을 넘긴 뒤 P1이 들어가는 순서입니다.',
  },
];

const stageData = [
  {
    label: '1. 진입 의사 표시',
    p0: 'flag[0] = true',
    p1: 'flag[1] = true',
    turn: 'turn = 0',
    note: '두 프로세스가 거의 동시에 임계 구역에 들어가려 한다.',
    active: ['flag0', 'flag1'],
    zone: null,
  },
  {
    label: '2. 충돌 감지',
    p0: 'flag[1] == true',
    p1: 'flag[0] == true',
    turn: 'turn = 0',
    note: '둘 다 상대방의 flag가 true인 것을 보고 충돌 상태를 확인한다.',
    active: ['flag0', 'flag1', 'turn'],
    zone: null,
  },
  {
    label: '3. 우선권 확인',
    p0: 'turn != 1, 대기 안 함',
    p1: 'turn == 0, 양보',
    turn: 'P0 우선',
    note: 'turn이 P0를 가리키므로 P1은 자기 flag를 내리고 기다린다.',
    active: ['turn', 'p1wait'],
    zone: null,
  },
  {
    label: '4. P0 임계 구역 진입',
    p0: 'critical section',
    p1: 'flag[1] = false',
    turn: 'turn = 0',
    note: 'P1이 양보했기 때문에 P0는 상대 flag가 false인 것을 보고 들어간다.',
    active: ['p0cs'],
    zone: 'p0',
  },
  {
    label: '5. 우선권 넘김',
    p0: 'turn = 1, flag[0] = false',
    p1: 'turn 변화 감지',
    turn: 'turn = 1',
    note: 'P0가 나오면서 다음 우선권을 P1에게 넘긴다.',
    active: ['turn', 'p1wait'],
    zone: null,
  },
  {
    label: '6. P1 재시도 후 진입',
    p0: 'remainder section',
    p1: 'critical section',
    turn: 'turn = 1',
    note: 'P1은 다시 flag를 올리고 임계 구역 진입을 완료한다.',
    active: ['p1cs'],
    zone: 'p1',
  },
];

const attempts = [
  ['1번', 'while(threadNumber == 상대번호)', '차례로 진입시키려 함', '엄격한 교대, 진행 조건 위반'],
  ['2번', 'while(상대Flag); 내Flag=true;', '상대가 없으면 진입하려 함', '검사와 표시가 분리되어 상호배제 위반'],
  ['3번', '내Flag=true; while(상대Flag);', '먼저 진입 의사를 표시함', '둘 다 true이면 교착 상태'],
  ['4번', '충돌 시 내Flag=false 후 재시도', '교착 상태를 피하려 함', '동시 양보가 반복되면 livelock'],
];

const slides = [
  {
    title: '데커 알고리즘',
    kicker: '운영체제 상호배제 알고리즘',
    type: 'hero',
    body: (
      <div className="heroGrid">
        <div className="heroCopy">
          <h1>flag와 turn으로 만든 최초의 올바른 순수 소프트웨어 상호배제</h1>
          <p>계좌 입금처럼 공유 자원이 동시에 수정되는 상황에서 왜 결과가 꼬이는지부터, 데커 알고리즘이 필요한 이유까지 흐름으로 설명합니다.</p>
        </div>
        <BankRace compact />
      </div>
    ),
    note: '도입 1분: 오늘 발표의 중심 질문은 “둘이 동시에 들어가려 할 때 누가 양보해야 하는가”입니다.',
  },
  {
    title: '발표 흐름',
    type: 'agenda',
    body: <Agenda items={['상호배제와 경쟁 상태', '1~4번 실패 버전의 문제점', 'flag와 turn의 역할', '데커 알고리즘 실행 추적', 'Java 구현과 현대 시스템에서의 한계']} />,
    note: '30분 발표 기준으로 앞부분 10분, 알고리즘 설명 12분, 한계와 정리 8분 정도로 배분합니다.',
  },
  {
    title: '상호배제 알고리즘이란?',
    body: <ConceptFlow />,
    note: '상호배제는 공유 데이터가 망가지지 않도록 임계 구역 입장을 통제하는 문제입니다.',
  },
  {
    title: '왜 문제가 생기는가: 계좌 입금 예시',
    body: <BankRaceSlide />,
    note: 'balance = balance + 1000은 한 줄이지만 읽기, 계산, 저장으로 쪼개집니다. 두 프로세스가 같은 10000을 읽으면 한 번의 입금이 사라집니다.',
  },
  {
    title: '임계영역을 막아야 하는 이유',
    body: <CriticalSectionIntro />,
    note: '공유 자원을 실제로 바꾸는 코드가 임계영역입니다. 이 구간에 동시에 들어가지 못하게 만드는 것이 상호배제 문제입니다.',
  },
  {
    title: '좋은 상호배제 알고리즘의 조건',
    body: <ConditionCards />,
    note: '상호배제만 맞으면 끝이 아닙니다. 들어갈 수 있어야 하고, 특정 프로세스가 무한히 밀리면 안 됩니다.',
  },
  {
    title: '데커 알고리즘이 중요한 이유',
    body: (
      <BigClaim
        icon={<GitBranch />}
        claim="공유 메모리의 flag와 turn만으로 두 프로세스의 임계 구역 문제를 해결한 초기 순수 소프트웨어 해법"
        details={['특별한 하드웨어 원자 명령 없이 동작한다는 점에서 이론적으로 중요', '상호배제, progress, bounded waiting을 함께 만족', '현대 락의 필요성을 설명하기 좋은 역사적 기준점']}
      />
    ),
    note: '실무에서 직접 쓰기보다는 운영체제 동기화 개념을 이해하는 교육적 의미가 큽니다.',
  },
  {
    title: '실패한 시도들 한눈에 보기',
    body: <AttemptTable />,
    note: '데커 알고리즘은 1~4번 실패를 거치며 turn만으로도, flag만으로도 부족하다는 결론에 도달합니다.',
  },
  {
    title: '1번: threadNumber 하나만 사용',
    body: <VersionSlide icon={<Timer />} code={version1Code} idea="threadNumber == 1이면 Thread-1만, threadNumber == 2이면 Thread-2만 진입한다." problem="Thread-2가 들어갈 생각이 없어도 threadNumber가 2이면 Thread-1은 계속 대기한다." conclusion="상호배제는 만족하지만, 고정된 순서 때문에 진행 조건을 위반한다." flow={['차례 확인', '임계영역 진입', '상대 차례로 변경']} />,
    note: '1번 버전은 차례를 강제로 정하기 때문에 상호배제는 지키지만, 임계 구역이 비어 있어도 못 들어가는 상황이 생깁니다.',
  },
  {
    title: '2번: 상대 flag 확인 후 내 flag 설정',
    body: <VersionSlide icon={<Flag />} code={version2Code} idea="상대방 flag가 false이면, 그 다음에 내 flag를 true로 만들고 들어간다." problem="확인 직후 내 flag를 true로 만들기 전에 문맥 교환이 발생하면 둘 다 통과할 수 있다." conclusion="검사와 표시가 분리되어 있으므로 상호배제가 깨진다." flow={['상대 flag 확인', '문맥 교환 가능', '동시 진입']} danger />,
    note: '2번 버전의 핵심 문제는 확인하는 순간과 표시하는 순간 사이에 다른 스레드가 끼어들 수 있다는 점입니다.',
  },
  {
    title: '3번: 내 flag 먼저 설정 후 확인',
    body: <VersionSlide icon={<ShieldCheck />} code={version3Code} idea="먼저 내가 들어가고 싶다는 의사를 true로 표시한 뒤 상대 flag를 확인한다." problem="Thread-1과 Thread-2가 모두 먼저 true를 만들면 서로를 기다리며 멈춘다." conclusion="상호배제는 지킬 수 있지만, 둘 다 기다리는 교착 상태가 발생한다." flow={['내 flag=true', '상대도 true', '서로 대기']} danger />,
    note: '3번 버전은 동시 진입은 막지만, 둘 다 양보하지 않아 deadlock이 생깁니다.',
  },
  {
    title: '4번: 충돌하면 flag를 잠시 내림',
    body: <VersionSlide icon={<RotateCcw />} code={version4Code} idea="상대방도 들어가려 하면 내 flag를 false로 내렸다가 다시 true로 올린다." problem="둘이 같은 타이밍으로 내렸다 올리면 계속 양보와 재시도만 반복할 수 있다." conclusion="교착 상태를 피하려 하지만, 무기한 연기 또는 livelock 가능성이 남는다." flow={['충돌 감지', 'flag 내림', '다시 true', '반복 충돌']} danger />,
    note: '4번 버전은 멈춰 있지는 않지만, 계속 움직이면서도 임계 구역에 못 들어가는 livelock이 가능합니다.',
  },
  {
    title: '데커의 결론',
    body: (
      <EquationFlow
        parts={[
          ['flag', '누가 들어가고 싶은가'],
          ['turn', '둘 다 원할 때 누가 먼저인가'],
          ['Dekker', '의사 표시와 우선권을 결합'],
        ]}
      />
    ),
    note: 'flag만으로는 충돌 해결이 안 되고, turn만으로는 불필요한 대기가 생깁니다.',
  },
  {
    title: '핵심 변수',
    body: (
      <TwoColumn
        left={<VariableCard name="flag[i]" role="프로세스 i가 임계 구역에 들어가고 싶다는 표시" example="flag[0] = true, flag[1] = true" />}
        right={<VariableCard name="turn" role="둘 다 들어가고 싶을 때 우선권을 가진 프로세스" example="turn = 0 또는 turn = 1" />}
      />
    ),
    note: 'flag와 turn은 같은 말이 아닙니다. 이 구분이 데커 알고리즘 이해의 핵심입니다.',
  },
  {
    title: '최종 데커 알고리즘 코드',
    body: <DekkerCodeSlide />,
    note: '우선권이 상대에게 있으면 자기 flag를 false로 내리고, turn이 바뀔 때까지 기다린 뒤 다시 진입 의사를 표시합니다.',
  },
  {
    title: '데커 알고리즘 실행 추적',
    type: 'tutor',
    body: <DekkerTutor />,
    note: '코드 줄, 변수 값, flag 배열, 임계 구역 상태를 한 단계씩 따라가며 데커 알고리즘의 동작을 확인합니다.',
  },
  {
    title: '장점 비교',
    body: <AlgorithmProsComparison />,
    note: '데커 알고리즘의 장점은 최초의 순수 소프트웨어 해법이라는 역사성과 flag/turn 개념을 잘 보여준다는 점입니다.',
  },
  {
    title: '단점 비교',
    body: <AlgorithmConsComparison />,
    note: '데커 알고리즘은 교육적으로 중요하지만, 두 프로세스 전용이고 코드가 복잡하며 busy waiting을 사용한다는 한계가 있습니다.',
  },
  {
    title: 'Peterson 알고리즘과 비교',
    body: <ComparePeterson />,
    note: '두 알고리즘은 모두 flag와 turn을 쓰지만 Peterson은 더 짧고 직관적인 형태로 교육에서 자주 등장합니다.',
  },
  {
    title: '최종 정리',
    body: <FinalSummary />,
    note: '마지막은 한 문장 암기형 답안으로 마무리합니다.',
  },
];

function App() {
  const initialSlide = Math.min(
    slides.length - 1,
    Math.max(0, Number.parseInt(new URLSearchParams(window.location.search).get('slide') || '1', 10) - 1),
  );
  const [index, setIndex] = useState(initialSlide);
  const [isPresentation, setIsPresentation] = useState(new URLSearchParams(window.location.search).get('present') === '1');
  const [presentationControlsVisible, setPresentationControlsVisible] = useState(true);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const slide = slides[index];

  const goPrev = () => setIndex((value) => Math.max(0, value - 1));
  const goNext = () => setIndex((value) => Math.min(slides.length - 1, value + 1));
  const goToSlideFromProgress = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const nextIndex = Math.min(slides.length - 1, Math.max(0, Math.floor(ratio * slides.length)));
    setIndex(nextIndex);
  };

  const downloadPdf = useCallback(() => {
    setIsExportingPdf(true);
    window.setTimeout(() => window.print(), 80);
  }, []);

  const enterPresentation = async () => {
    setIsPresentation(true);
    setPresentationControlsVisible(true);
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      setIsPresentation(true);
    }
  };

  const exitPresentation = async () => {
    setIsPresentation(false);
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      setIsPresentation(false);
    }
  };

  useEffect(() => {
    const onKey = (event) => {
      if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) return;
      if (event.key === 'ArrowRight' || event.key === ' ') goNext();
      if (event.key === 'ArrowLeft') goPrev();
      if (event.key.toLowerCase() === 'f') enterPresentation();
      if (event.key.toLowerCase() === 'p') downloadPdf();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [downloadPdf]);

  useEffect(() => {
    const onAfterPrint = () => setIsExportingPdf(false);
    window.addEventListener('afterprint', onAfterPrint);
    return () => window.removeEventListener('afterprint', onAfterPrint);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('pdf-exporting', isExportingPdf);
    return () => document.body.classList.remove('pdf-exporting');
  }, [isExportingPdf]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsPresentation(Boolean(document.fullscreenElement));
      setPresentationControlsVisible(true);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!isPresentation || !presentationControlsVisible) return undefined;
    const timer = window.setTimeout(() => setPresentationControlsVisible(false), 2000);
    return () => window.clearTimeout(timer);
  }, [isPresentation, presentationControlsVisible, index]);

  return (
    <>
      <main
        className={`deck ${isPresentation ? 'presentation' : ''}`}
        onMouseMove={() => {
          if (isPresentation) setPresentationControlsVisible(true);
        }}
      >
        <section className={`slide ${slide.type || ''}`}>
          <div className="slideTop">
            <span>{slide.kicker || 'Dekker Algorithm'}</span>
            <span>{String(index + 1).padStart(2, '0')} / {slides.length}</span>
          </div>
          {slide.title && <h2>{slide.title}</h2>}
          {index === 0 && (
            <button className="pdfDownloadButton" type="button" onClick={downloadPdf}>
              <FileDown size={18} />
              <span>PDF 다운로드</span>
            </button>
          )}
          <div className="slideBody">{slide.body}</div>
          <footer className="speakerNote">{slide.note}</footer>
        </section>
        <nav className={`controls ${isPresentation ? 'presentationControls' : ''} ${presentationControlsVisible ? 'visible' : ''}`} aria-label="slide navigation">
          <button onClick={goPrev} aria-label="previous slide"><ArrowLeft size={18} /></button>
          <button
            className="progress"
            type="button"
            onClick={goToSlideFromProgress}
            aria-label="슬라이드 위치 선택"
            aria-valuemin={1}
            aria-valuemax={slides.length}
            aria-valuenow={index + 1}
          >
            <span style={{ width: `${((index + 1) / slides.length) * 100}%` }} />
          </button>
          <button onClick={goNext} aria-label="next slide"><ArrowRight size={18} /></button>
        </nav>
        <button
          className={`presentationToggle ${isPresentation ? 'active visible' : ''} ${presentationControlsVisible ? 'visible' : ''}`}
          onClick={isPresentation ? exitPresentation : enterPresentation}
        >
          {isPresentation ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          <span>{isPresentation ? '나가기' : '발표 시작'}</span>
        </button>
        {isPresentation && (
          <div className={`presentationPageBadge ${presentationControlsVisible ? 'visible' : ''}`}>
            {String(index + 1).padStart(2, '0')} / {slides.length}
          </div>
        )}
      </main>
      {isExportingPdf && (
        <main className="deck printDeck" aria-hidden="true">
          {slides.map((printSlide, slideIndex) => (
            <section className={`slide ${printSlide.type || ''}`} key={`${printSlide.title}-${slideIndex}`}>
              <div className="slideTop">
                <span>{printSlide.kicker || 'Dekker Algorithm'}</span>
                <span>{String(slideIndex + 1).padStart(2, '0')} / {slides.length}</span>
              </div>
              {printSlide.title && <h2>{printSlide.title}</h2>}
              <div className="slideBody">{printSlide.body}</div>
              <footer className="speakerNote">{printSlide.note}</footer>
            </section>
          ))}
        </main>
      )}
    </>
  );
}

function Agenda({ items }) {
  return <ol className="agendaList">{items.map((item) => <li key={item}>{item}</li>)}</ol>;
}

function TextBlock({ icon, title, text }) {
  return <div className="textBlock"><div className="iconBadge">{icon}</div><h3>{title}</h3><p>{text}</p></div>;
}

function DefinitionStack({ items }) {
  return <div className="definitionStack">{items.map(([term, desc]) => <div key={term}><strong>{term}</strong><span>{desc}</span></div>)}</div>;
}

function TwoColumn({ left, right }) {
  return <div className="twoColumn"><div>{left}</div><div>{right}</div></div>;
}

function ConceptFlow() {
  return (
    <div className="conceptFlow">
      <TextBlock icon={<ShieldCheck />} title="목표" text="여러 프로세스 또는 스레드가 공유 자원에 접근할 때, 한 순간에 오직 하나만 임계 구역에 들어가도록 제어한다." />
      <FlowDiagram
        items={[
          ['공유 자원', '여러 실행 흐름이 함께 사용하는 데이터나 장치'],
          ['임계 구역', '공유 자원에 접근하는 코드 구간'],
          ['경쟁 상태', '동시 접근으로 결과가 실행 순서에 따라 달라지는 문제'],
          ['상호배제', '임계 영역에는 한 번에 하나만 들어가게 하는 원칙'],
        ]}
      />
    </div>
  );
}

function FlowDiagram({ items }) {
  return (
    <div className="flowDiagram">
      {items.map(([title, desc], idx) => (
        <React.Fragment key={title}>
          <div className={idx === items.length - 1 ? 'flowNode primary' : 'flowNode'}>
            <strong>{title}</strong>
            <span>{desc}</span>
          </div>
          {idx < items.length - 1 && <div className="flowArrow">→</div>}
        </React.Fragment>
      ))}
    </div>
  );
}

function ProcessRace({ compact = false }) {
  return (
    <div className={`racePanel ${compact ? 'compact' : ''}`}>
      <div className="processor p0">P0</div>
      <div className="sharedCounter">count<br /><strong>7</strong></div>
      <div className="processor p1">P1</div>
      <div className="raceArrow left">read 7</div>
      <div className="raceArrow right">read 7</div>
      <div className="lostUpdate">결과: 8</div>
    </div>
  );
}

function BankRace({ compact = false }) {
  return (
    <div className={`bankPanel ${compact ? 'compact' : ''}`}>
      <div className="bankProcess p0">
        <strong>P1</strong>
        <span>10000 읽음</span>
        <b>+1000</b>
      </div>
      <div className="bankAccount">
        <span>balance</span>
        <strong>10000</strong>
        <em>기대값 12000</em>
      </div>
      <div className="bankProcess p1">
        <strong>P2</strong>
        <span>10000 읽음</span>
        <b>+1000</b>
      </div>
      <div className="bankResult">최종 결과: 11000</div>
    </div>
  );
}

function BankRaceSlide() {
  const rows = [
    ['1', 'balance 10000 읽음', '', '10000'],
    ['2', '', 'balance 10000 읽음', '10000'],
    ['3', '10000 + 1000 계산', '', '10000'],
    ['4', '', '10000 + 1000 계산', '10000'],
    ['5', '11000 저장', '', '11000'],
    ['6', '', '11000 저장', '11000'],
  ];

  return (
    <div className="bankSlide">
      <div className="raceFlow">
        <BankRace />
        <FlowDiagram items={[['읽기', 'balance 10000'], ['계산', '10000 + 1000'], ['저장', '11000']]} />
      </div>
      <div className="bankTableWrap">
        <div className="codeLine">balance = balance + 1000;</div>
        <table className="bankTable">
          <thead><tr><th>순서</th><th>P1</th><th>P2</th><th>balance</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row[0]}>{row.map((cell, idx) => <td key={`${row[0]}-${idx}`}>{cell}</td>)}</tr>)}</tbody>
        </table>
        <p>두 번 입금했으므로 정답은 12000이어야 하지만, 동시에 같은 값을 읽어서 11000이 된다.</p>
      </div>
    </div>
  );
}

function CriticalSectionIntro() {
  return (
    <div className="criticalIntro">
      <CodePanel code={`// 임계영역 시작\nbalance = balance + 1000;\n// 임계영역 끝`} small />
      <div className="criticalRule">
        <h3>상호배제가 보장해야 하는 것</h3>
        <p>한 프로세스가 임계영역에 들어가 있으면, 다른 프로세스는 같은 임계영역에 동시에 들어갈 수 없다.</p>
        <div className="lockVisual">
          <span>P1 입장</span>
          <strong>Critical Section</strong>
          <span>P2 대기</span>
        </div>
      </div>
    </div>
  );
}

function IncrementRace() {
  return (
    <div className="incrementGrid">
      <ProcessRace />
      <div className="microSteps">
        {['count 값을 읽음', 'count + 1 계산', '다시 count에 저장'].map((step, idx) => <div key={step}><span>{idx + 1}</span>{step}</div>)}
        <p>두 스레드가 동시에 같은 값을 읽으면 증가가 한 번만 반영되는 경쟁 상태가 발생한다.</p>
      </div>
    </div>
  );
}

function ConditionCards() {
  const cards = [
    ['상호배제', '동시에 둘 이상이 임계 구역에 들어가면 안 됨'],
    ['Progress', '임계 구역이 비어 있고 들어가려는 프로세스가 있으면 누군가는 들어가야 함'],
    ['Bounded Waiting', '특정 프로세스가 무한히 기다리면 안 됨'],
    ['교착 상태 없음', '서로 기다리기만 해서 아무도 못 들어가는 상황 방지'],
  ];
  return <div className="conditionGrid">{cards.map(([name, desc]) => <div key={name}><h3>{name}</h3><p>{desc}</p></div>)}</div>;
}

function BigClaim({ icon, claim, details }) {
  return <div className="bigClaim"><div className="bigIcon">{icon}</div><p>{claim}</p><ul>{details.map((item) => <li key={item}>{item}</li>)}</ul></div>;
}

function AttemptTable() {
  return (
    <div className="tableWrap">
      <table>
        <thead><tr><th>버전</th><th>핵심 코드</th><th>해결하려던 문제</th><th>실제 문제</th></tr></thead>
        <tbody>{attempts.map((row) => <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function AttemptSlide({ icon, code, strength, problem }) {
  return (
    <div className="attemptDetail">
      <div className="attemptCodeStack">
        <CodePanel code={code} small />
        <AttemptMiniFlow />
      </div>
      <div className="attemptText">
        <div className="iconBadge">{icon}</div>
        <h3>장점</h3>
        <p>{strength}</p>
        <h3 className="dangerTitle">문제점</h3>
        <p className="dangerText">{problem}</p>
      </div>
    </div>
  );
}

function VersionSlide({ icon, code, idea, problem, conclusion, flow, danger = false }) {
  return (
    <div className="versionSlide">
      <CodePanel code={code} small />
      <div className="versionContent">
        <div className="versionSummary">
          <div className="iconBadge">{icon}</div>
          <h3>핵심 아이디어</h3>
          <p>{idea}</p>
          <h3 className={danger ? 'dangerTitle' : ''}>문제점</h3>
          <p className={danger ? 'dangerText' : ''}>{problem}</p>
          <h3>결론</h3>
          <p>{conclusion}</p>
        </div>
        <div className="versionFlow">
          {flow.map((item, idx) => (
            <React.Fragment key={item}>
              <span className={idx === flow.length - 1 && danger ? 'fail' : ''}>{item}</span>
              {idx < flow.length - 1 && <b>→</b>}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

function CodePanel({ code, small = false }) {
  return <pre className={`codePanel ${small ? 'small' : ''}`}><code>{code}</code></pre>;
}

function AttemptMiniFlow() {
  return (
    <div className="attemptMiniFlow">
      <span>검사</span>
      <b>→</b>
      <span>충돌</span>
      <b>→</b>
      <span className="fail">실패 원인</span>
    </div>
  );
}

function DekkerCodeSlide() {
  return (
    <div className="dekkerCodeSlide">
      <CodePanel code={codeDekker} />
      <div className="dekkerVisual">
        <FlowDiagram items={[['flag 설정', '진입 의사 표시'], ['turn 확인', '충돌 시 우선권 판단'], ['양보/대기', '우선권이 없으면 flag를 내림'], ['임계영역 진입', '한 번에 하나만 들어감']]} />
        <div className="criticalPath">
          <span>P0</span>
          <strong>Critical Section</strong>
          <span>P1</span>
        </div>
      </div>
    </div>
  );
}

function Timeline({ steps }) {
  return <div className="timeline">{steps.map((step, idx) => <div key={step} className={idx === steps.length - 1 ? 'dangerStep' : ''}><span>{idx + 1}</span><p>{step}</p></div>)}</div>;
}

function EquationFlow({ parts }) {
  return <div className="equationFlow">{parts.map(([name, desc], idx) => <React.Fragment key={name}><div><strong>{name}</strong><span>{desc}</span></div>{idx < parts.length - 1 && <b>+</b>}</React.Fragment>)}</div>;
}

function VariableCard({ name, role, example }) {
  return <div className="variableCard"><h3>{name}</h3><p>{role}</p><code>{example}</code></div>;
}

function DekkerTutor() {
  const [stepIndex, setStepIndex] = useState(0);
  const step = executionSteps[stepIndex];

  const runTrace = () => setStepIndex(1);
  const resetTrace = () => setStepIndex(0);

  return (
    <div className="tutorApp">
      <div className="tutorMain">
        <section className="tutorLeft">
          <CodeEditor code={dekkerTutorCode} currentLine={step.line} onRun={runTrace} onReset={resetTrace} />
        </section>
        <section className="tutorRight">
          <MemoryPanel memory={step.memory} changed={step.changed} criticalSection={step.variables.criticalSection} />
          <VariablePanel variables={step.variables} changed={step.changed} />
          <ConsolePanel logs={step.console} changed={step.changed?.includes('console')} />
        </section>
      </div>
      <div className="tutorBottom">
        <ExecutionControls
          stepIndex={stepIndex}
          totalSteps={executionSteps.length}
          onFirst={() => setStepIndex(0)}
          onPrev={() => setStepIndex((value) => Math.max(0, value - 1))}
          onNext={() => setStepIndex((value) => Math.min(executionSteps.length - 1, value + 1))}
          onLast={() => setStepIndex(executionSteps.length - 1)}
        />
        <StepTimeline steps={executionSteps} currentStep={stepIndex} onSelect={setStepIndex} />
        <ExplanationPanel step={step} stepIndex={stepIndex} totalSteps={executionSteps.length} />
      </div>
    </div>
  );
}

function CodeEditor({ code, currentLine, onRun, onReset }) {
  const lines = code.split('\n');

  return (
    <div className="tutorPanel codeEditorPanel">
      <div className="panelHeader">
        <strong>Code Editor</strong>
        <span>{currentLine > 0 ? `${currentLine}번 줄 실행 중` : '대기'}</span>
        <div className="editorButtons">
          <button onClick={onRun}>실행</button>
          <button onClick={onReset}>초기화</button>
        </div>
      </div>
      <div className="codeEditorBody">
        <pre className="traceCode">
          {lines.map((line, idx) => {
            const lineNumber = idx + 1;
            return (
              <div key={`${lineNumber}-${line}`} className={`traceLine ${currentLine === lineNumber ? 'active' : ''}`}>
                <span>{lineNumber}</span>
                <code>{line || ' '}</code>
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
}

function ExecutionControls({ stepIndex, totalSteps, onFirst, onPrev, onNext, onLast }) {
  return (
    <div className="executionControls">
      <button onClick={onFirst}>처음으로</button>
      <button onClick={onPrev}>이전 단계</button>
      <strong>{stepIndex + 1} / {totalSteps}</strong>
      <button onClick={onNext}>다음 단계</button>
      <button onClick={onLast}>끝으로</button>
    </div>
  );
}

function VariablePanel({ variables, changed = [] }) {
  const entries = Object.entries(variables || {});

  return (
    <div className="tutorPanel variablePanel">
      <div className="panelHeader"><strong>Variables</strong><span>현재 변수</span></div>
      {entries.length === 0 ? <p className="emptyState">아직 생성된 변수가 없습니다.</p> : (
        <div className="variableGrid">
          {entries.map(([name, value]) => (
            <div key={name} className={`valueCard ${changed.includes(name) ? 'changed' : ''}`}>
              <span>{name}</span>
              <ValueView value={value} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MemoryPanel({ memory, changed = [], criticalSection }) {
  const entries = Object.entries(memory || {});

  return (
    <div className="tutorPanel memoryPanel">
      <div className="panelHeader"><strong>Memory / Objects</strong><span>배열과 객체</span></div>
      <div className="memoryLayout">
        {entries.length === 0 ? <p className="emptyState">아직 메모리에 객체가 없습니다.</p> : entries.map(([id, object]) => (
          <div key={id} className={`memoryObject ${changed.includes(id) ? 'changed' : ''}`}>
            <div className="objectTitle">{object.name} <span>{id}</span></div>
            {object.type === 'array' && (
              <div className="arrayBox">
                {object.values.map((value, idx) => (
                  <div key={`${id}-${idx}`} className={object.changedIndexes?.includes(idx) ? 'cellChanged' : ''}>
                    <span>{idx}</span>
                    <ValueView value={value} />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        <div className={`criticalMemory ${criticalSection ? 'occupied' : ''}`}>
          <span>Critical Section</span>
          <strong>{criticalSection || 'empty'}</strong>
        </div>
      </div>
    </div>
  );
}

function ConsolePanel({ logs, changed }) {
  return (
    <div className="tutorPanel consolePanel">
      <div className="panelHeader"><strong>Console</strong><span>System.out.println</span></div>
      <div className={`consoleOutput ${changed ? 'changed' : ''}`}>
        {logs.length === 0 ? <span className="emptyState">출력 없음</span> : logs.map((log, idx) => <p key={`${log}-${idx}`}>{log}</p>)}
      </div>
    </div>
  );
}

function ExplanationPanel({ step, stepIndex, totalSteps }) {
  return (
    <div className="explanationPanel">
      <span>Step {stepIndex + 1} / {totalSteps}</span>
      <p>{step.explanation}</p>
    </div>
  );
}

function StepTimeline({ steps, currentStep, onSelect }) {
  return (
    <div className="stepTimeline">
      {steps.map((step, idx) => (
        <button
          key={`${idx}-${step.line}`}
          className={idx === currentStep ? 'active' : ''}
          onClick={() => onSelect(idx)}
          aria-label={`${idx + 1}단계`}
        />
      ))}
    </div>
  );
}

function ValueView({ value }) {
  if (typeof value === 'string' && value.startsWith('&')) {
    return <b className="referenceValue">{value} →</b>;
  }

  if (typeof value === 'boolean') {
    return <b className={value ? 'booleanTrue' : 'booleanFalse'}>{String(value)}</b>;
  }

  if (value === null) {
    return <b className="nullValue">null</b>;
  }

  if (typeof value === 'number') {
    return <b className="numberValue">{value}</b>;
  }

  if (typeof value === 'string') {
    return <b className="stringValue">"{value}"</b>;
  }

  return <b>{JSON.stringify(value)}</b>;
}

function DekkerAnimation() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const data = stageData[step];

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => setStep((value) => (value + 1) % stageData.length), 2200);
    return () => window.clearInterval(timer);
  }, [playing]);

  const active = useMemo(() => new Set(data.active), [data]);

  return (
    <div className="animationWrap">
      <div className="simBoard">
        <div className={`simProcess ${active.has('p0cs') ? 'inZone' : ''}`}>
          <strong>P0</strong>
          <span>{data.p0}</span>
        </div>
        <div className={`criticalZone ${data.zone ? 'occupied' : ''}`}>
          <KeyRound size={28} />
          <span>Critical Section</span>
          <b>{data.zone ? data.zone.toUpperCase() : 'empty'}</b>
        </div>
        <div className={`simProcess ${active.has('p1wait') ? 'waiting' : ''} ${active.has('p1cs') ? 'inZone' : ''}`}>
          <strong>P1</strong>
          <span>{data.p1}</span>
        </div>
      </div>
      <div className="statePanel">
        <h3>{data.label}</h3>
        <div className="stateChips">
          <span className={active.has('flag0') ? 'active' : ''}>flag[0]</span>
          <span className={active.has('flag1') ? 'active' : ''}>flag[1]</span>
          <span className={active.has('turn') ? 'active' : ''}>{data.turn}</span>
        </div>
        <p>{data.note}</p>
        <div className="stepControls">
          <button onClick={() => setPlaying((value) => !value)}>{playing ? <Pause size={17} /> : <Play size={17} />}</button>
          <button onClick={() => setStep((value) => (value + 1) % stageData.length)}><ArrowRight size={17} /></button>
        </div>
      </div>
    </div>
  );
}

function Scenario({ title, lines }) {
  return <div className="scenario"><h3>{title}</h3>{lines.map((line, idx) => <div key={line}><span>{idx + 1}</span><p>{line}</p></div>)}</div>;
}

function BenefitGrid({ items }) {
  return <div className="benefitGrid">{items.map(([title, text]) => <div key={title}><h3>{title}</h3><p>{text}</p></div>)}</div>;
}

function RiskList({ items }) {
  return <ul className="riskList">{items.map((item) => <li key={item}>{item}</li>)}</ul>;
}

function AlgorithmProsComparison() {
  const rows = [
    ['데커', 'flag + turn', '하드웨어 원자 명령 없이 상호배제, progress, bounded waiting을 설명할 수 있음'],
    ['피터슨', 'flag + turn', '데커보다 코드가 짧고 조건식이 단순해서 교육용으로 이해하기 쉬움'],
    ['베이커리', '번호표', '여러 프로세스 확장 아이디어를 직관적으로 보여줌'],
    ['세마포어', 'wait / signal', '실무 시스템에서 여러 스레드와 자원 개수 제어에 활용 가능'],
  ];

  return <AlgorithmCompareTable rows={rows} lastHeader="주요 장점" mode="pros" />;
}

function AlgorithmConsComparison() {
  const rows = [
    ['데커', '2개 프로세스', 'Peterson보다 복잡하고 busy waiting이 있으며 현대 메모리 모델에서 그대로 쓰기 어려움'],
    ['피터슨', '2개 프로세스', '기본 형태는 2개 프로세스 전용이고 busy waiting을 사용함'],
    ['베이커리', 'N개 프로세스', '번호 선택과 비교 과정이 많아지고 실제 구현에서는 원자성/메모리 가시성 관리가 필요함'],
    ['세마포어', 'N개 스레드/자원', '잘못 사용하면 deadlock, signal 누락, 순서 오류가 발생할 수 있음'],
  ];

  return <AlgorithmCompareTable rows={rows} lastHeader="주요 단점" mode="cons" />;
}

function AlgorithmCompareTable({ rows, lastHeader, mode }) {
  return (
    <div className={`algorithmCompare ${mode}`}>
      <table>
        <thead>
          <tr><th>알고리즘</th><th>핵심 방식</th><th>{lastHeader}</th></tr>
        </thead>
        <tbody>
          {rows.map(([name, method, point]) => (
            <tr key={name}>
              <td><strong>{name}</strong></td>
              <td>{method}</td>
              <td>{point}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="compareFocus">
        <strong>{mode === 'pros' ? '데커의 위치' : '발표 핵심'}</strong>
        <p>{mode === 'pros'
          ? '데커는 실무 도구라기보다, flag와 turn만으로 상호배제를 완성한 초기 순수 소프트웨어 해법이라는 점이 중요하다.'
          : '데커는 이론적으로 의미가 크지만, 실제 프로그램에서는 Peterson보다 복잡하고 Semaphore 같은 도구보다 실용성이 낮다.'}</p>
      </div>
    </div>
  );
}

function ComparePeterson() {
  return (
    <div className="compareGrid">
      <div><h3>Dekker</h3><CodePanel code={codeDekker.split('\n').slice(0, 12).join('\n')} small /><p>우선권이 상대에게 있으면 flag를 내리고 기다렸다가 다시 올린다.</p></div>
      <div><h3>Peterson</h3><CodePanel code={codePeterson} small /><p>먼저 상대에게 turn을 넘긴 뒤, 상대도 원하고 우선권도 상대에게 있으면 기다린다.</p></div>
    </div>
  );
}

function ModernAlternatives() {
  const items = [
    ['synchronized', 'JVM monitor 기반의 기본 동기화'],
    ['ReentrantLock', '명시적 lock/unlock과 고급 제어 제공'],
    ['Semaphore', '동시에 접근 가능한 허용 수를 제어'],
    ['CAS / Atomic', '하드웨어 원자 연산 기반 비차단 갱신'],
    ['ConcurrentHashMap', '동시 접근을 전제로 설계된 컬렉션'],
  ];
  return <div className="modernGrid">{items.map(([name, desc]) => <div key={name}><Gauge size={24} /><h3>{name}</h3><p>{desc}</p></div>)}</div>;
}

function FinalSummary() {
  return (
    <div className="finalSummary">
      <p>상호배제 필요 → 단순 lock 실패 → turn의 엄격한 교대 → flag의 교착 상태 → flag 양보의 livelock → flag + turn 결합</p>
      <blockquote>데커 알고리즘은 flag로 진입 의사를 표시하고, turn으로 충돌 시 우선권을 정해 두 프로세스의 상호배제, progress, bounded waiting을 만족시키는 순수 소프트웨어 알고리즘이다.</blockquote>
      <p>다만 두 프로세스 전용, busy waiting, 현대 메모리 모델 문제 때문에 실무에서는 JVM과 운영체제가 제공하는 동기화 도구를 사용한다.</p>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
