type FieldProps = {
  label: string;
  value: string | number | undefined;
};

export const Label = ({
  children,
}: {
  children: string | number | undefined;
}) => (
  <p className="text-xs uppercase tracking-wide text-gray-400">{children}</p>
);

export const Value = ({
  children,
}: {
  children: string | number | undefined;
}) => <p className="text-sm font-medium">{children ?? "—"}</p>;

function Field({ label, value }: FieldProps) {
  return (
    <div>
      <Label>{label}</Label>
      <Value>{value}</Value>
    </div>
  );
}

export default Field;
