import { Chip } from "./heroui-chip";

export default function ChipDefaultDemo() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center overflow-hidden bg-background p-8">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Chip>Default</Chip>
        <Chip color="accent">Accent</Chip>
        <Chip color="success">Success</Chip>
        <Chip color="warning">Warning</Chip>
        <Chip color="danger">Danger</Chip>
      </div>
    </div>
  );
}

export { ChipDefaultDemo };
