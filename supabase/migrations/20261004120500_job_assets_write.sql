-- Manager write access for job_assets + link_reports resolution.
grant insert, update, delete on public.job_assets to authenticated;

create policy "Managers insert job assets"
on public.job_assets for insert to authenticated
with check ((select public.manages_job(job_id)));
create policy "Managers update job assets"
on public.job_assets for update to authenticated
using ((select public.manages_job(job_id))) with check ((select public.manages_job(job_id)));
create policy "Managers delete job assets"
on public.job_assets for delete to authenticated
using ((select public.manages_job(job_id)));
