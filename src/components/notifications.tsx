import { Toaster } from "react-hot-toast";

export default function Notifications({
  duration = 5000,
  successDuration = 3000,
}: {
  duration?: number;
  successDuration?: number;
}) {
  return (
    <Toaster
      position="top-center"
      reverseOrder={false}
      gutter={8}
      containerClassName=""
      containerStyle={{}}
      toastOptions={{
        className:
          "dark:bg-gray-900 dark:text-white dark:ring-1 dark:ring-gray-500 rounded-md",
        duration,
        success: {
          duration: successDuration,
          iconTheme: {
            primary: "green",
            secondary: "white",
          },
        },
      }}
    />
  );
}
