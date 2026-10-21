import EventDashboard from "../../../components/EventDashboard";

export default async function EventPage({ params }) {
  const { id } = await params;
  return <EventDashboard id={id} />;
}
