type FieldProps = {
  label: string;
  value: string | number | undefined;
};

function Field({ label, value }: FieldProps) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-sm font-medium">{value ?? "—"}</p>
    </div>
  );
}

export default Field;
