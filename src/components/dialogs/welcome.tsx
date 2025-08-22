import { DialogCloseX, DialogContainer } from "../dialog";

export const WelcomeDialog = () => {
  return (
    <DialogContainer size="md">
      <div className="w-full flex flex-col h-full">
        <div className="flex-shrink-0 w-full flex flex-row justify-between items-center pb-4">
          <h1 className="text-2xl font-bold">Welcome</h1>
          <DialogCloseX />
        </div>
        <div className="flex-grow flex flex-col items-stretch p-1 min-h-0">
          <p className="text-gray-500">
            This is the new welcome dialog (FLAG_WELCOME enabled).
          </p>
        </div>
      </div>
    </DialogContainer>
  );
};
