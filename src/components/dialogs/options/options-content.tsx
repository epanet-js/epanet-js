import { forwardRef, useCallback } from "react";
import { NumericField } from "src/components/form/numeric-field";
import { Selector, type SelectorOption } from "src/components/form/selector";
import { optionCategories, type OptionDefinition } from "./options-data";

type Props = {
  values: Record<string, string | number>;
  onChange: (optionId: string, value: string | number) => void;
};

export const OptionsContent = forwardRef<HTMLDivElement, Props>(
  function OptionsContent({ values, onChange }, ref) {
    const measureRef = useCallback(
      (node: HTMLDivElement | null) => {
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
        if (!node) return;
        const updateHeight = () => {
          node.style.setProperty("--scroll-height", `${node.clientHeight}px`);
        };
        updateHeight();
        const observer = new ResizeObserver(updateHeight);
        observer.observe(node);
      },
      [ref],
    );

    return (
      <div
        ref={measureRef}
        className="flex-1 min-h-0 overflow-y-auto placemark-scrollbar scroll-shadows pl-4"
      >
        <div className="flex flex-col gap-8 py-2">
          {optionCategories.map((category) => (
            <div
              key={category.id}
              data-section-id={category.id}
              className="last:min-h-[calc(var(--scroll-height)-1rem)]"
            >
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white pb-3 border-b border-gray-200 dark:border-gray-700 mb-3">
                {category.label}
              </h3>
              <div className="flex flex-col gap-4">
                {category.options.map((option) => (
                  <OptionRow
                    key={option.id}
                    option={option}
                    value={values[option.id]}
                    onChange={onChange}
                  />
                ))}
                {category.subcategories?.map((sub) => (
                  <div
                    key={sub.id}
                    data-section-id={sub.id}
                    className="flex flex-col gap-4"
                  >
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-2">
                      {sub.label}
                    </div>
                    {sub.options.map((option) => (
                      <OptionRow
                        key={option.id}
                        option={option}
                        value={values[option.id]}
                        onChange={onChange}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },
);

const OptionRow = ({
  option,
  value,
  onChange,
}: {
  option: OptionDefinition;
  value: string | number;
  onChange: (optionId: string, value: string | number) => void;
}) => {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-sm text-gray-900 dark:text-gray-100">
        {option.label}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {option.description}
      </div>
      <div className="w-60 mt-0.5">
        <OptionInput option={option} value={value} onChange={onChange} />
      </div>
    </div>
  );
};

const OptionInput = ({
  option,
  value,
  onChange,
}: {
  option: OptionDefinition;
  value: string | number;
  onChange: (optionId: string, value: string | number) => void;
}) => {
  if (option.type === "select" && option.options) {
    const selectorOptions: SelectorOption<string>[] = option.options.map(
      (o) => ({
        label: o.label,
        value: o.value,
      }),
    );
    return (
      <Selector
        ariaLabel={option.label}
        options={selectorOptions}
        selected={String(value)}
        onChange={(newValue) => onChange(option.id, newValue)}
        styleOptions={{
          border: true,
          textSize: "text-sm",
          paddingY: 2,
        }}
      />
    );
  }

  if (option.type === "number") {
    return (
      <NumericField
        label={option.label}
        displayValue={String(value)}
        positiveOnly={false}
        isNullable={false}
        onChangeValue={(newValue) => onChange(option.id, newValue)}
        styleOptions={{
          textSize: "sm",
        }}
      />
    );
  }

  return (
    <input
      type="text"
      value={String(value)}
      onChange={(e) => onChange(option.id, e.target.value)}
      className="w-full p-2 text-sm border border-gray-300 rounded-sm bg-white dark:bg-gray-900 dark:border-gray-600 text-gray-700 dark:text-gray-100 focus-visible:ring-inset focus-visible:ring-1 focus-visible:ring-purple-500"
      aria-label={option.label}
    />
  );
};
