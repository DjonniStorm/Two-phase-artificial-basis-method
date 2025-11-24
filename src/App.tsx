import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@components/ui/resizable';
import { Toaster } from '@components/ui/sonner';
import { LinearSystemInput } from '@features/input-block';
import { ResultBlock } from '@features/result-block';

function App() {
  return (
    <main className="flex-1 min-w-full flex flex-col">
      <Toaster />
      <ResizablePanelGroup
        direction="vertical"
        className="min-h-[800px] rounded-lg border md:min-w-[450px] flex-1"
      >
        <ResizablePanel defaultSize={1000}>
          <LinearSystemInput />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={1000} className="overflow-hidden">
          <div className="h-full overflow-auto">
            <ResultBlock />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  );
}

export { App };

